import { describe, expect, it } from 'vitest';
import { providerReady, statusAfterDelivery } from './messaging.js';

const empty = {
  whatsappToken: '',
  whatsappPhoneNumberId: '',
  smsApiUrl: '',
  smsApiToken: '',
};

describe('statusAfterDelivery', () => {
  it('records a provider acceptance as sent and a rejection as failed', () => {
    expect(statusAfterDelivery(true)).toBe('SENT');
    expect(statusAfterDelivery(false)).toBe('FAILED');
  });
});

describe('providerReady', () => {
  it('stays closed when credentials are missing', () => {
    expect(providerReady('WHATSAPP', empty)).toBe(false);
    expect(providerReady('SMS', empty)).toBe(false);
  });

  it('opens only the channel whose pair of credentials is set', () => {
    expect(
      providerReady('WHATSAPP', {
        ...empty,
        whatsappToken: 'token',
        whatsappPhoneNumberId: '123',
      }),
    ).toBe(true);
    expect(providerReady('SMS', { ...empty, smsApiUrl: 'https://sms.example', smsApiToken: 'token' })).toBe(
      true,
    );
  });
});
