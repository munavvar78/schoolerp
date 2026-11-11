import { useLocalSearchParams } from 'expo-router';
import { ExamDetailScreen } from '../../../src/screens/ExamDetailScreen';

function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default function ExamRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  return <ExamDetailScreen id={param(params.id)} />;
}
