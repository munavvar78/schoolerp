import { useLocalSearchParams } from 'expo-router';
import { OnlineExamQuestionScreen } from '../../../../src/screens/OnlineExamQuestionScreen';

function param(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function OnlineExamQuestionRoute() {
  const params = useLocalSearchParams<{ id: string; questionId?: string }>();
  const assessmentId = param(params.id) ?? '';
  const questionId = param(params.questionId);
  return <OnlineExamQuestionScreen assessmentId={assessmentId} questionId={questionId} />;
}
