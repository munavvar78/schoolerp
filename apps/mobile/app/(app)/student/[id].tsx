import { useLocalSearchParams } from 'expo-router';
import { StudentDetailScreen } from '../../../src/screens/StudentDetailScreen';

function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default function StudentRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  return <StudentDetailScreen id={param(params.id)} />;
}
