import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MODULES, type ModuleKey } from '@school-erp/shared';
import { apiFetch } from '../api/client';
import { errorText } from '../api/errors';
import { Button, Card, EmptyState, ErrorBanner, Screen, SkeletonList, SuccessBanner } from '../components/ui';
import { colors, fonts, space } from '../theme';

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  enabledModules: string[];
  _count: { campuses: number; students: number; users: number };
};

export function PlatformScreen() {
  const client = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const organizations = useQuery({
    queryKey: ['platform', 'organizations'],
    queryFn: () => apiFetch<OrganizationRow[]>('/platform/organizations'),
  });
  const save = useMutation({
    mutationFn: (row: OrganizationRow) =>
      apiFetch(`/platform/organizations/${row.id}/modules`, {
        method: 'PUT',
        json: { enabledModules: row.enabledModules },
      }),
    onSuccess: async () => {
      setMessage('Modules saved');
      await client.invalidateQueries({ queryKey: ['platform', 'organizations'] });
    },
  });

  function toggle(row: OrganizationRow, module: ModuleKey) {
    const selected = new Set(row.enabledModules);
    if (selected.has(module)) selected.delete(module);
    else selected.add(module);
    const enabledModules = MODULES.filter((item) => selected.has(item));
    client.setQueryData<OrganizationRow[]>(['platform', 'organizations'], (current) =>
      (current ?? []).map((item) => (item.id === row.id ? { ...item, enabledModules } : item)),
    );
  }

  return (
    <Screen title="Master" subtitle="Organizations and enabled modules" back refreshing={organizations.isRefetching} onRefresh={() => void organizations.refetch()}>
      {message ? <SuccessBanner message={message} /> : null}
      {save.isError ? <ErrorBanner message={errorText(save.error)} /> : null}
      {organizations.isLoading ? <SkeletonList /> : null}
      {organizations.isError ? (
        <ErrorBanner message={errorText(organizations.error)} onRetry={() => void organizations.refetch()} />
      ) : null}
      {!organizations.isLoading && (organizations.data?.length ?? 0) === 0 ? (
        <EmptyState title="No organizations" />
      ) : null}
      {(organizations.data ?? []).map((row) => (
        <Card key={row.id}>
          <Text style={styles.title}>{row.name}</Text>
          <Text style={styles.meta}>
            {row.slug} · {row._count.campuses} campuses · {row._count.students} students · {row._count.users} users
          </Text>
          <View style={styles.modules}>
            {MODULES.map((module) => {
              const on = row.enabledModules.includes(module);
              return (
                <Pressable key={module} onPress={() => toggle(row, module)} style={[styles.chip, on && styles.chipOn]}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{module}</Text>
                </Pressable>
              );
            })}
          </View>
          <Button label="Save modules" onPress={() => save.mutate(row)} loading={save.isPending} />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontFamily: fonts.medium, fontSize: 16 },
  meta: { color: colors.muted, fontFamily: fonts.regular, marginTop: 4, marginBottom: space.sm },
  modules: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginBottom: space.md },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipOn: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  chipText: { color: colors.muted, fontSize: 12, fontFamily: fonts.medium },
  chipTextOn: { color: colors.brandDark },
});
