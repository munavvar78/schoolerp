import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { recordPaymentSchema } from '@school-erp/shared';
import { apiFetch } from '../api/client';
import { errorText } from '../api/errors';
import type { FeeDemand, FeeSummary, Student } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { Badge, Button, Card, EmptyState, ErrorBanner, Screen, SkeletonList, Stat, SuccessBanner, TextField } from '../components/ui';
import { formatInr, formatPrettyDate, isoDateOnly, personName, rupeesToPaise } from '../lib/format';
import { hapticSuccess } from '../lib/haptics';
import { FEE_WRITE_ROLES, hasModule, isFamilyRole, roleCan } from '../lib/roles';
import { colors, fonts, radius, space } from '../theme';

const METHODS = ['CASH', 'UPI', 'CHEQUE', 'BANK_TRANSFER', 'CARD'] as const;

export function FeesScreen() {
  const { session } = useAuth();
  const client = useQueryClient();
  const family = session ? isFamilyRole(session.role) : false;
  const canRecord = roleCan(session?.role, FEE_WRITE_ROLES);
  const [openId, setOpenId] = useState<string | null>(null);
  const [rupees, setRupees] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]>('UPI');
  const [reference, setReference] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const summary = useQuery({
    queryKey: ['fees', 'summary', session?.campusId],
    enabled: Boolean(session) && !family,
    queryFn: () => apiFetch<FeeSummary>('/fees/summary'),
  });
  const demands = useQuery({
    queryKey: ['fees', 'outstanding', session?.campusId],
    enabled: Boolean(session) && hasModule(session, 'fees'),
    queryFn: () => apiFetch<FeeDemand[]>('/fees/outstanding'),
  });
  const children = useQuery({
    queryKey: ['students', 'mine', session?.campusId],
    enabled: Boolean(session && family),
    queryFn: () => apiFetch<Student[]>('/students/my-children'),
  });

  const pay = useMutation({
    mutationFn: async (demand: FeeDemand) => {
      const amountPaise = rupeesToPaise(rupees);
      if (amountPaise == null) throw new Error('Enter an amount in rupees, up to 2 decimal places');
      const parsed = recordPaymentSchema.safeParse({
        feeDemandId: demand.id,
        amountPaise,
        method,
        reference: reference.trim() || undefined,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check the payment');
      return apiFetch('/fees/payments', { method: 'POST', json: parsed.data });
    },
    onSuccess: async () => {
      setSaved('Payment recorded');
      setOpenId(null);
      setRupees('');
      setReference('');
      setFormError(null);
      await client.invalidateQueries({ queryKey: ['fees'] });
      await hapticSuccess();
    },
    onError: (error) => setFormError(errorText(error)),
  });

  const online = useMutation({
    mutationFn: (demand: FeeDemand) =>
      apiFetch<{ checkoutPath: string }>('/fees/orders', {
        method: 'POST',
        json: { feeDemandId: demand.id, amountPaise: demand.outstandingPaise },
      }),
    onSuccess: async (order) => {
      const web = process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3000';
      await Linking.openURL(`${web.replace(/\/$/, '')}${order.checkoutPath}`);
    },
    onError: (error) => setFormError(errorText(error)),
  });

  const childIds = new Set((children.data ?? []).map((child) => child.id));
  const rows = (demands.data ?? []).filter((demand) => {
    if (!family) return demand.outstandingPaise > 0;
    const id = demand.enrollment?.student?.id ?? demand.enrollment?.studentId;
    return demand.outstandingPaise > 0 && (id ? childIds.has(id) : false);
  });

  const loading = demands.isLoading || (family && children.isLoading);
  const refreshing = demands.isRefetching || summary.isRefetching;

  return (
    <Screen
      title="Fees"
      subtitle={family ? 'What is due' : 'Outstanding and receipts'}
      refreshing={refreshing}
      onRefresh={() => {
        void demands.refetch();
        void summary.refetch();
      }}
    >
      {saved ? <SuccessBanner message={saved} /> : null}
      {formError ? <ErrorBanner message={formError} /> : null}
      {summary.data && !family ? (
        <View style={styles.stats}>
          <Stat label="Demand" value={formatInr(summary.data.demandTotal)} />
          <Stat label="Collected" value={formatInr(summary.data.collected)} tone="success" />
          <Stat label="Outstanding" value={formatInr(summary.data.outstanding)} tone="warning" />
        </View>
      ) : null}
      {loading ? <SkeletonList /> : null}
      {demands.isError ? <ErrorBanner message={errorText(demands.error)} onRetry={() => void demands.refetch()} /> : null}
      {!loading && rows.length === 0 ? <EmptyState title="No outstanding dues" body="Open demands show up here." /> : null}
      {rows.map((demand) => {
        const student = demand.enrollment?.student;
        const open = openId === demand.id;
        return (
          <Card key={demand.id}>
            <Text style={styles.title}>{student ? personName(student) : demand.periodLabel}</Text>
            <Text style={styles.meta}>
              {demand.periodLabel} · due {formatPrettyDate(isoDateOnly(demand.dueDate))}
            </Text>
            <View style={styles.row}>
              <Badge label={formatInr(demand.outstandingPaise)} tone="warning" />
              {demand.lateFeePaise > 0 ? <Badge label={`Late ${formatInr(demand.lateFeePaise)}`} /> : null}
            </View>
            <View style={styles.actions}>
              <Button
                label={online.isPending ? 'Opening…' : 'Pay online'}
                onPress={() => online.mutate(demand)}
                loading={online.isPending}
              />
              {canRecord ? (
                <Button
                  label="Record"
                  variant="secondary"
                  onPress={() => {
                    setOpenId(open ? null : demand.id);
                    setRupees((demand.outstandingPaise / 100).toFixed(2));
                    setFormError(null);
                  }}
                />
              ) : null}
            </View>
            {open && canRecord ? (
              <View style={styles.form}>
                <TextField label="Amount (₹)" value={rupees} onChangeText={setRupees} keyboardType="decimal-pad" />
                <View style={styles.methods}>
                  {METHODS.map((item) => (
                    <Pressable key={item} onPress={() => setMethod(item)} style={[styles.method, method === item && styles.methodOn]}>
                      <Text style={styles.methodText}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextField label="Reference" value={reference} onChangeText={setReference} />
                <Button label="Save payment" onPress={() => pay.mutate(demand)} loading={pay.isPending} />
              </View>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  title: { color: colors.text, fontFamily: fonts.medium, fontSize: 16 },
  meta: { color: colors.muted, marginTop: 4, fontFamily: fonts.regular },
  row: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  form: { marginTop: space.md, gap: space.sm },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  method: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  methodOn: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  methodText: { color: colors.text, fontSize: 12, fontFamily: fonts.medium },
});
