export type MessageChannel = 'SMS' | 'WHATSAPP';

export type MessageProviderConfig = {
  whatsappToken: string;
  whatsappPhoneNumberId: string;
  smsApiUrl: string;
  smsApiToken: string;
};

export function statusAfterDelivery(delivered: boolean): 'SENT' | 'FAILED' {
  return delivered ? 'SENT' : 'FAILED';
}

export function providerReady(channel: MessageChannel, config: MessageProviderConfig) {
  if (channel === 'WHATSAPP') {
    return Boolean(config.whatsappToken && config.whatsappPhoneNumberId);
  }
  return Boolean(config.smsApiUrl && config.smsApiToken);
}

export async function deliverMessage(input: {
  channel: MessageChannel;
  recipient: string;
  body: string;
  config: MessageProviderConfig;
}): Promise<{ delivered: boolean; reason?: string }> {
  if (!providerReady(input.channel, input.config)) {
    return { delivered: false, reason: 'Provider is not configured' };
  }
  if (input.channel === 'WHATSAPP') {
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${input.config.whatsappPhoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${input.config.whatsappToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: input.recipient.replace(/^\+/, ''),
          type: 'text',
          text: { body: input.body },
        }),
      },
    );
    return response.ok
      ? { delivered: true }
      : { delivered: false, reason: 'WhatsApp rejected the message' };
  }
  const response = await fetch(input.config.smsApiUrl, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.config.smsApiToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ to: input.recipient, body: input.body }),
  });
  return response.ok ? { delivered: true } : { delivered: false, reason: 'SMS provider rejected the message' };
}
