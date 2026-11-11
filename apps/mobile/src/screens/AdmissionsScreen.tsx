import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { canTransitionAdmission, type AdmissionStatus, transitionAdmissionSchema } from '@school-erp/shared';
import { apiFetch } from '../api/client';
import { errorText } from '../api/errors';
import type { AdmissionRow } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { Badge, Card, EmptyState, ErrorBanner, Screen, SkeletonList, SuccessBanner } from '../components/ui';
import { personName } from '../lib/format';
import { hapticSuccess } from '../lib/haptics';
import { ADMISSION_FEE_ROLES, ADMISSION_WRITE_ROLES, roleCan } from '../lib/roles';
import { colors, fonts, radius, space } from '../theme';

const NEXT: AdmissionStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'WAITLISTED', 'OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'];

export function AdmissionsScreen() {
  const { session } = useAuth();
  const client = useQueryClient();
  const canMove = roleCan(session?.role, ADMISSION_WRITE_ROLES);
  const canRecordFee = roleCan(session?.role, ADMISSION_FEE_ROLES);
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ['admissions', session?.campusId],
    enabled: Boolean(session),
    queryFn: () => apiFetch<AdmissionRow[]>('/admissions'),
  });
  const move = useMutation({
    mutationFn: async (input: { applicationId: string; status: AdmissionStatus }) => {
      const parsed = transitionAdmissionSchema.safeParse(input);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'That status is not allowed');
      return apiFetch('/admissions/transition', { method: 'POST', json: parsed.data });
    },
    onSuccess: async (_data, variables) => {
      setNote(`Moved to ${variables.status.replaceAll('_', ' ').toLowerCase()}`);
      setOpenId(null);
      await client.invalidateQueries({ queryKey: ['admissions'] });
      await hapticSuccess();
    },
  });
  const recordFee = useMutation({
    mutationFn: (application: AdmissionRow) => {
      const due = Math.max(0, (application.admissionFeePaise ?? 0) - (application.admissionFeePaidPaise ?? 0));
      return apiFetch('/admissions/fee', {
        method: 'POST',
        json: { applicationId: application.id, amountPaise: due || 250000, method: 'UPI' },
      });
    },
    onSuccess: async () => {
      setNote('Admission fee recorded');
      await client.invalidateQueries({ queryKey: ['admissions'] });
      await hapticSuccess();
    },
  });

  return (
    <Screen title="Admissions" subtitle="Applications on this campus" back refreshing={list.isRefetching} onRefresh={() => void list.refetch()}>
      {note ? <SuccessBanner message={note} /> : null}
      {list.isLoading ? <SkeletonList /> : null}
      {list.isError ? <ErrorBanner message={errorText(list.error)} onRetry={() => void list.refetch()} /> : null}
      {!list.isLoading && (list.data?.length ?? 0) === 0 ? <EmptyState title="No applications" /> : null}
      {(list.data ?? []).map((application) => {
        const status = application.status as AdmissionStatus;
        const options = NEXT.filter((next) => canTransitionAdmission(status, next));
        return (
          <Card key={application.id}>
            <View style={styles.head}>
              <Text style={styles.name}>{personName(application)}</Text>
              <Badge label={application.status.replaceAll('_', ' ')} tone="brand" />
            </View>
            <Text style={styles.meta}>
              {[application.grade?.name, application.session?.name, application.contactName, application.contactPhone].filter(Boolean).join(' · ')}
            </Text>
            {canMove && options.length > 0 ? (
              openId === application.id ? (
                <View style={styles.options}>
                  {options.map((next) => (
                    <Pressable key={next} style={styles.option} onPress={() => move.mutate({ applicationId: application.id, status: next })}>
                      <Text style={styles.optionText}>{next.replaceAll('_', ' ')}</Text>
                    </Pressable>
                  ))}
                  {move.isError ? <ErrorBanner message={errorText(move.error)} /> : null}
                </View>
              ) : (
                <Pressable onPress={() => setOpenId(application.id)}>
                  <Text style={styles.link}>Update status</Text>
                </Pressable>
              )
            ) : null}
            {canRecordFee &&
            ['OFFERED', 'ACCEPTED'].includes(application.status) &&
            (application.admissionFeePaidPaise ?? 0) < (application.admissionFeePaise ?? 0) ? (
              <Pressable onPress={() => recordFee.mutate(application)} disabled={recordFee.isPending}>
                <Text style={styles.link}>Record fee</Text>
              </Pressable>
            ) : null}
            {recordFee.isError && recordFee.variables?.id === application.id ? (
              <ErrorBanner message={errorText(recordFee.error)} />
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm, alignItems: 'center' },
  name: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, lineHeight: 20 },
  link: { fontFamily: fonts.semibold, fontSize: 15, color: colors.brand, marginTop: 4 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  option: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    justifyContent: 'center',
  },
  optionText: { fontFamily: fonts.medium, fontSize: 13, color: colors.brandDark },
});
