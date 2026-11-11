import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { type Href, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { apiFetch } from '../api/client';
import { errorText } from '../api/errors';
import type { Enrollment, Student } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { EmptyState, ErrorBanner, Screen, SkeletonList } from '../components/ui';
import { personName } from '../lib/format';
import { useDebouncedValue } from '../lib/useDebounced';
import { isFamilyRole } from '../lib/roles';
import { colors, fonts, radius, space } from '../theme';

function currentEnrollment(student: Student): Enrollment | undefined {
  return student.enrollments?.find((item) => item.session?.isCurrent) ?? student.enrollments?.[0];
}

function sectionLabel(student: Student): string {
  const enrollment = currentEnrollment(student);
  if (!enrollment?.section) return 'Not enrolled';
  return [enrollment.section.grade?.name, enrollment.section.name, enrollment.rollNo ? `Roll ${enrollment.rollNo}` : null]
    .filter(Boolean)
    .join(' · ');
}

export function StudentsScreen() {
  const { session } = useAuth();
  const family = session ? isFamilyRole(session.role) : false;
  const router = useRouter();
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query.trim(), 300);
  const students = useQuery({
    queryKey: family ? ['students', 'mine', session?.campusId] : ['students', 'list', session?.campusId, debounced],
    enabled: Boolean(session),
    queryFn: () =>
      family
        ? apiFetch<Student[]>('/students/my-children')
        : apiFetch<Student[]>(`/students${debounced ? `?q=${encodeURIComponent(debounced)}` : ''}`),
  });

  return (
    <Screen title={family ? 'Children' : 'Students'} subtitle={family ? 'Linked to your account' : 'Search by name or admission no'} scroll={false}>
      <FlatList
        data={students.data ?? []}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        refreshing={students.isRefetching}
        onRefresh={() => void students.refetch()}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          family ? undefined : (
            <View style={styles.search}>
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search students"
                placeholderTextColor={colors.subtle}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.searchInput}
              />
            </View>
          )
        }
        ListEmptyComponent={
          students.isLoading ? (
            <SkeletonList />
          ) : students.isError ? (
            <ErrorBanner message={errorText(students.error)} onRetry={() => void students.refetch()} />
          ) : (
            <EmptyState
              title={debounced ? 'No matching students' : family ? 'No linked students' : 'No students yet'}
              body={family ? 'Ask the office to link this account to a student.' : 'Students added on the web app appear here.'}
            />
          )
        }
        ListFooterComponent={
          !family && (students.data?.length ?? 0) >= 200 ? (
            <Text style={styles.footer}>Showing the first 200 matches. Search to narrow the list.</Text>
          ) : undefined
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => router.push(`/student/${item.id}` as Href)}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.firstName.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.fill}>
              <Text style={styles.name}>{personName(item)}</Text>
              <Text style={styles.meta}>
                {item.admissionNo} · {sectionLabel(item)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.sm },
  search: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.text, paddingVertical: 10 },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  pressed: { opacity: 0.75 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 18, color: colors.brandDark },
  fill: { flex: 1 },
  name: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  meta: { marginTop: 2, fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  footer: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: space.md },
});
