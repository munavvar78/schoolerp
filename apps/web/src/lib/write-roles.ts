import type { Role } from '@school-erp/shared';
import { getSession } from './session';

const TEACHING = new Set<Role>(['ORG_OWNER', 'CAMPUS_ADMIN', 'TEACHER', 'CLASS_TEACHER']);
const EXAM_PUBLISH = new Set<Role>(['ORG_OWNER', 'CAMPUS_ADMIN', 'CLASS_TEACHER']);

function role() {
  return getSession()?.role;
}

export function sessionCanTeach() {
  const current = role();
  return current ? TEACHING.has(current) : false;
}

export function sessionCanPublishExam() {
  const current = role();
  return current ? EXAM_PUBLISH.has(current) : false;
}
