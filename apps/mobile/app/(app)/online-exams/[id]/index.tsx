import { useLocalSearchParams } from 'expo-router';
import { OnlineExamDetailScreen } from '../../../../src/screens/OnlineExamDetailScreen';

function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default function OnlineExamDetailRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  return <OnlineExamDetailScreen id={param(params.id)} />;
}
