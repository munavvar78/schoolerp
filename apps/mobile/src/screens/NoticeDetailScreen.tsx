import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text } from 'react-native';
import { apiFetch } from '../api/client';
import { errorText } from '../api/errors';
import type { Notice } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { Badge, Card, EmptyState, ErrorBanner, Screen, SkeletonList } from '../components/ui';
import { formatDateTime } from '../lib/format';
import { NOTICE_WRITE_ROLES, roleCan } from '../lib/roles';
import { colors, fonts } from '../theme';

export function NoticeDetailScreen({ id }: { id: string }) {
  const { session } = useAuth();
  const staffList = roleCan(session?.role, NOTICE_WRITE_ROLES) || session?.role === 'PLATFORM_OPERATOR';
  const inbox = useQuery({
    queryKey: ['notices', staffList ? 'all' : 'inbox', session?.campusId],
    enabled: Boolean(session),
    queryFn: () => apiFetch<Notice[]>(staffList ? '/notices' : '/notices/inbox'),
  });
  const notice = inbox.data?.find((item) => item.id === id);

  return (
    <Screen title="Notice" back refreshing={inbox.isRefetching} onRefresh={() => void inbox.refetch()}>
      {inbox.isLoading ? <SkeletonList rows={2} /> : null}
      {inbox.isError ? <ErrorBanner message={errorText(inbox.error)} onRetry={() => void inbox.refetch()} /> : null}
      {!inbox.isLoading && !notice ? <EmptyState title="Notice unavailable" body="It may have expired or it is not addressed to you." /> : null}
      {notice ? (
        <Card>
          <Badge label={notice.priority === 'NORMAL' ? notice.category : `${notice.priority} · ${notice.category}`} tone={notice.priority === 'URGENT' ? 'danger' : notice.priority === 'HIGH' ? 'warning' : 'brand'} />
          <Text style={styles.title}>{notice.title}</Text>
          <Text style={styles.meta}>{formatDateTime(notice.publishedAt)}</Text>
          <Text style={styles.body}>{notice.body}</Text>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 24, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.text },
});
