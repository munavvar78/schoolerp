/**
 * Live tenant isolation check: school A token cannot see school B students.
 * Run with API up after seed: pnpm --filter @school-erp/api exec tsx scripts/tenant-check.ts
 */
const API = process.env.API_URL ?? 'http://localhost:4000/api';

async function login(email: string, password: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed for ${email}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ accessToken: string; organizationId: string }>;
}

async function registerOtherOrg() {
  const stamp = Date.now();
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organizationName: `Isolation Trust ${stamp}`,
      campusName: `Campus ${stamp}`,
      board: 'CBSE',
      ownerName: 'Other Owner',
      email: `owner-${stamp}@isolation.test`,
      password: 'Password123!',
    }),
  });
  if (!res.ok) throw new Error(`Register failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ accessToken: string; organizationId: string }>;
}

async function studentsCount(token: string) {
  const res = await fetch(`${API}/tenant/students-count`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`students-count failed: ${res.status}`);
  return res.json() as Promise<{ organizationId: string; count: number }>;
}

async function listStudents(token: string) {
  const res = await fetch(`${API}/students`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`students list failed: ${res.status}`);
  return res.json() as Promise<Array<{ admissionNo: string; organizationId?: string }>>;
}

async function main() {
  const a = await login('admin@bharatvidya.edu', 'Password123!');
  const b = await registerOtherOrg();

  const countA = await studentsCount(a.accessToken);
  const countB = await studentsCount(b.accessToken);
  const listA = await listStudents(a.accessToken);
  const listB = await listStudents(b.accessToken);

  if (countA.organizationId === countB.organizationId) {
    throw new Error('Organizations should differ');
  }
  if (countA.count < 1) throw new Error('Demo school should have students');
  if (countB.count !== 0) throw new Error('New org should start with 0 students');
  if (listB.some((s) => listA.some((x) => x.admissionNo === s.admissionNo))) {
    throw new Error('Cross-tenant student leakage detected');
  }

  console.log('tenant-check OK', {
    orgA: countA.organizationId,
    orgB: countB.organizationId,
    studentsA: countA.count,
    studentsB: countB.count,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
