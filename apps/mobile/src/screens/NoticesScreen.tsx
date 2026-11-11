import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Href, useRouter } from 'expo-router';
import { apiFetch } from '../api/client';
import { errorText } from '../api/errors';
import type { Notice } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { Badge, EmptyState, ErrorBanner, Screen, SkeletonList } from '../components/ui';
import { formatDateTime } from '../lib/format';
import { NOTICE_WRITE_ROLES, roleCan } from '../lib/roles';
import { colors, fonts, radius, space } from '../theme';

function tone(priority: Notice['priority']): 'neutral' | 'warning' | 'danger' {
  if (priority === 'URGENT') return 'danger';
  if (priority === 'HIGH') return 'warning';
  return 'neutral';
}

export function NoticesScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const client = useQueryClient();
  const canWrite = roleCan(session?.role, NOTICE_WRITE_ROLES);
  const staffList = canWrite || session?.role === 'PLATFORM_OPERATOR';
  const inbox = useQuery({
    queryKey: ['notices', staffList ? 'all' : 'inbox', session?.campusId],
    enabled: Boolean(session),
    queryFn: () => apiFetch<Notice[]>(staffList ? '/notices' : '/notices/inbox'),
  });
  const markRead = useMutation({
    mutationFn: (noticeId: string) => apiFetch('/notices/read', { method: 'POST', json: { noticeId } }),
    onMutate: async (noticeId) => {
      await client.cancelQueries({ queryKey: ['notices', 'inbox', session?.campusId] });
      const previous = client.getQueryData<Notice[]>(['notices', 'inbox', session?.campusId]);
      client.setQueryData<Notice[]>(['notices', 'inbox', session?.campusId], (current) =>
        current?.map((notice) =>
          notice.id === noticeId && (notice.receipts?.length ?? 0) === 0
            ? { ...notice, receipts: [{ id: 'pending' }] }
            : notice,
        ),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) client.setQueryData(['notices', 'inbox', session?.campusId], context.previous);
    },
  });

  return (
    <Screen
      title="Notices"
      subtitle={staffList ? 'Drafts and published notices' : 'Published for you'}
      scroll={false}
      right={
        canWrite ? (
          <Pressable onPress={() => router.push('/compose-notice' as Href)} hitSlop={8}>
            <Text style={styles.new}>New</Text>
          </Pressable>
        ) : null
      }
    >
      <FlatList
        data={inbox.data ?? []}
        keyExtractor={(item) => item.id}
        refreshing={inbox.isRefetching}
        onRefresh={() => void inbox.refetch()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          inbox.isLoading ? (
            <SkeletonList />
          ) : inbox.isError ? (
            <ErrorBanner message={errorText(inbox.error)} onRetry={() => void inbox.refetch()} />
          ) : (
            <EmptyState title="No notices" body="Published notices for your role or class appear here." />
          )
        }
        renderItem={({ item }) => {
          const unread = (item.receipts?.length ?? 0) === 0;
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => {
                if (!staffList && unread) markRead.mutate(item.id);
                router.push(`/notice/${item.id}` as Href);
              }}
            >
              <View style={styles.head}>
                <Badge label={item.priority === 'NORMAL' ? item.category : item.priority} tone={tone(item.priority)} />
                {staffList && !item.publishedAt ? <Badge label="Draft" tone="neutral" /> : null}
                {!staffList && unread ? <View style={styles.dot} /> : null}
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body} numberOfLines={2}>
                {item.body}
              </Text>
              <Text style={styles.meta}>{formatDateTime(item.publishedAt)}</Text>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.sm },
  new: { fontFamily: fonts.semibold, fontSize: 16, color: colors.brand, paddingHorizontal: 8 },
  row: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: 6,
  },
  pressed: { opacity: 0.75 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
  title: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted, lineHeight: 21 },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.subtle },
});
