import { useState } from 'react';
import { Linking, StyleSheet, Text } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CERTIFICATE_TYPES, issueCertificateSchema, type CertificateType } from '@school-erp/shared';
import { apiFetch } from '../api/client';
import { errorText } from '../api/errors';
import type { Student } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { Badge, Button, Card, EmptyState, ErrorBanner, Screen, SelectField, SkeletonList, SuccessBanner, TextField } from '../components/ui';
import { personName } from '../lib/format';
import { hapticSuccess } from '../lib/haptics';
import { roleCan } from '../lib/roles';
import { colors, fonts } from '../theme';

type CertificateRow = {
  id: string;
  type: string;
  serialNo: string;
  purpose: string;
  verificationCode: string;
  revokedAt?: string | null;
  student?: { firstName: string; lastName?: string | null; admissionNo: string };
};

const ISSUE_ROLES = ['ORG_OWNER', 'CAMPUS_ADMIN', 'ACCOUNTANT', 'PLATFORM_OPERATOR'] as const;

export function CertificatesScreen() {
  const { session } = useAuth();
  const client = useQueryClient();
  const canIssue = roleCan(session?.role, ISSUE_ROLES);
  const accountant = session?.role === 'ACCOUNTANT';
  const types = (accountant ? ['FEE_CLEARANCE'] : CERTIFICATE_TYPES) as CertificateType[];
  const [studentId, setStudentId] = useState('');
  const [type, setType] = useState<CertificateType>(accountant ? 'FEE_CLEARANCE' : 'BONAFIDE');
  const [purpose, setPurpose] = useState('');
  const [reason, setReason] = useState('');
  const [leavingDate, setLeavingDate] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const certificates = useQuery({
    queryKey: ['certificates', session?.campusId],
    enabled: Boolean(session),
    queryFn: () => apiFetch<CertificateRow[]>('/certificates'),
  });
  const students = useQuery({
    queryKey: ['students', 'certificate', session?.campusId],
    enabled: Boolean(session && canIssue),
    queryFn: () => apiFetch<Student[]>('/students'),
  });

  const issue = useMutation({
    mutationFn: async () => {
      const parsed = issueCertificateSchema.safeParse({
        studentId,
        type,
        purpose,
        reason: reason.trim() || undefined,
        leavingDate: leavingDate.trim() || undefined,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check the certificate');
      return apiFetch<CertificateRow>('/certificates', { method: 'POST', json: parsed.data });
    },
    onSuccess: async (created) => {
      setMessage(`Issued ${created.serialNo}`);
      setPurpose('');
      setReason('');
      setLeavingDate('');
      setFormError(null);
      await client.invalidateQueries({ queryKey: ['certificates'] });
      await hapticSuccess();
    },
    onError: (error) => setFormError(errorText(error)),
  });

  return (
    <Screen
      title="Certificates"
      subtitle="Bonafide, transfer, and fee clearance"
      back
      refreshing={certificates.isRefetching}
      onRefresh={() => void certificates.refetch()}
    >
      {message ? <SuccessBanner message={message} /> : null}
      {formError ? <ErrorBanner message={formError} /> : null}
      {certificates.isLoading ? <SkeletonList /> : null}
      {certificates.isError ? (
        <ErrorBanner message={errorText(certificates.error)} onRetry={() => void certificates.refetch()} />
      ) : null}
      {!certificates.isLoading && (certificates.data?.length ?? 0) === 0 ? (
        <EmptyState title="No certificates" body="Issued certificates for this campus show up here." />
      ) : null}
      {(certificates.data ?? []).map((row) => (
        <Card key={row.id}>
          <Text style={styles.title}>{row.serialNo}</Text>
          <Text style={styles.meta}>
            {row.student ? `${row.student.admissionNo} · ${personName(row.student)}` : row.type}
          </Text>
          <Badge label={row.revokedAt ? 'REVOKED' : row.type} tone={row.revokedAt ? 'danger' : 'success'} />
          <Button
            label="Open check"
            variant="secondary"
            onPress={() => {
              const web = process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3000';
              void Linking.openURL(`${web.replace(/\/$/, '')}/verify-certificate?code=${row.verificationCode}`);
            }}
          />
        </Card>
      ))}
      {canIssue ? (
        <Card>
          <Text style={styles.title}>Issue</Text>
          <SelectField
            label="Student"
            value={studentId}
            options={(students.data ?? []).map((student) => ({
              value: student.id,
              label: `${student.admissionNo} · ${personName(student)}`,
            }))}
            onChange={setStudentId}
          />
          <SelectField
            label="Type"
            value={type}
            options={types.map((item) => ({ value: item, label: item }))}
            onChange={setType}
          />
          <TextField label="Purpose" value={purpose} onChangeText={setPurpose} />
          {type === 'TRANSFER' ? (
            <>
              <TextField label="Date of leaving (YYYY-MM-DD)" value={leavingDate} onChangeText={setLeavingDate} />
              <TextField label="Reason" value={reason} onChangeText={setReason} />
            </>
          ) : null}
          <Button label="Issue certificate" onPress={() => issue.mutate()} loading={issue.isPending} />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontFamily: fonts.medium, fontSize: 16, marginBottom: 4 },
  meta: { color: colors.muted, fontFamily: fonts.regular, marginBottom: 8 },
});
