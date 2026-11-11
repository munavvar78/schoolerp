import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { apiFetch } from '../../src/api/client';
import { errorText } from '../../src/api/errors';
import { Button, Card, ErrorBanner, Screen, SuccessBanner } from '../../src/components/ui';
import { colors, fonts } from '../../src/theme';

export default function PrivacyRoute() {
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [exported, setExported] = useState<string | null>(null);

  async function request(kind: 'EXPORT' | 'ERASURE') {
    setFormError(null);
    try {
      const result = await apiFetch<{
        request: { status: string; reason: string };
        export?: { name: string; email: string };
      }>('/privacy/requests', { method: 'POST', json: { kind } });
      if (result.export) setExported(`${result.export.name} · ${result.export.email}`);
      setMessage(`${result.request.status}. ${result.request.reason}`);
    } catch (error) {
      setFormError(errorText(error));
    }
  }

  return (
    <Screen title="Privacy" subtitle="Erasure does not delete fee or payroll records">
      {message ? <SuccessBanner message={message} /> : null}
      {formError ? <ErrorBanner message={formError} /> : null}
      <Card>
        {exported ? <Text style={styles.line}>{exported}</Text> : null}
        <Button label="Export my data" onPress={() => void request('EXPORT')} />
        <Button label="Request erasure" variant="secondary" onPress={() => void request('ERASURE')} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { color: colors.ink, fontFamily: fonts.regular, fontSize: 14, marginBottom: 8 },
});
