import { useLocalSearchParams } from 'expo-router';
import { NoticeDetailScreen } from '../../../src/screens/NoticeDetailScreen';

function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default function NoticeRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  return <NoticeDetailScreen id={param(params.id)} />;
}
