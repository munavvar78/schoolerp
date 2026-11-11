import { useState } from 'react';
import { apiFetch } from '../../src/api/client';
import { errorText } from '../../src/api/errors';
import { Button, Card, ErrorBanner, Screen, SuccessBanner, TextField } from '../../src/components/ui';

const STATUSES = ['MISSING', 'ISSUED', 'REFUSED', 'NOGEN'] as const;

export default function ApaarRoute() {
  const [studentId, setStudentId] = useState('');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('MISSING');
  const [apaarId, setApaarId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function save() {
    setFormError(null);
    try {
      await apiFetch('/students/apaar', {
        method: 'POST',
        json: { studentId, status, apaarId: apaarId.trim() || undefined },
      });
      setMessage('APAAR status saved. Aadhaar is not stored.');
    } catch (error) {
      setFormError(errorText(error));
    }
  }

  return (
    <Screen title="APAAR" subtitle="12 digits only when the status is Issued">
      {message ? <SuccessBanner message={message} /> : null}
      {formError ? <ErrorBanner message={formError} /> : null}
      <Card>
        <TextField label="Student id" value={studentId} onChangeText={setStudentId} />
        <Button
          label={status}
          variant="secondary"
          onPress={() => {
            const next = STATUSES[(STATUSES.indexOf(status) + 1) % STATUSES.length];
            if (next) setStatus(next);
          }}
        />
        <TextField label="APAAR ID" value={apaarId} onChangeText={setApaarId} keyboardType="number-pad" />
        <Button label="Save" onPress={() => void save()} />
      </Card>
    </Screen>
  );
}
