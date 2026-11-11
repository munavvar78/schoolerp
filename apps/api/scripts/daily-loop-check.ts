/**
 * API-level daily loop: enroll, attendance, fee payment, exam publish, parent scope.
 */
const API = process.env.API_URL ?? 'http://127.0.0.1:4000/api';

async function json<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const body = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${body}`);
  return body ? (JSON.parse(body) as T) : (null as T);
}

async function main() {
  const admin = await json<{ accessToken: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@bharatvidya.edu', password: 'Password123!' }),
  });

  const sessions = await json<Array<{ id: string; isCurrent: boolean }>>(
    '/academic/sessions',
    {},
    admin.accessToken,
  );
  const grades = await json<Array<{ id: string; sections: Array<{ id: string }> }>>(
    '/academic/grades',
    {},
    admin.accessToken,
  );
  const sessionId = sessions.find((s) => s.isCurrent)?.id ?? sessions[0]!.id;
  const sectionId = grades[0]!.sections[0]!.id;

  const stamp = Date.now().toString().slice(-6);
  const student = await json<{ id: string }>('/students', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Loop',
      lastName: 'Check',
      admissionNo: `ADM-LOOP-${stamp}`,
    }),
  }, admin.accessToken);

  await json('/students/enroll', {
    method: 'POST',
    body: JSON.stringify({
      studentId: student.id,
      sectionId,
      sessionId,
      rollNo: '99',
    }),
  }, admin.accessToken);

  const grid = await json<{
    enrollments: Array<{ id: string }>;
    statuses: Array<{ code: string }>;
  }>(
    `/attendance/grid?sectionId=${sectionId}&sessionId=${sessionId}&date=2026-04-08`,
    {},
    admin.accessToken,
  );

  await json('/attendance/mark', {
    method: 'POST',
    body: JSON.stringify({
      sectionId,
      sessionId,
      date: '2026-04-08',
      marks: grid.enrollments.map((e) => ({
        enrollmentId: e.id,
        statusCode: 'PRESENT',
      })),
    }),
  }, admin.accessToken);

  const outstanding = await json<Array<{ id: string; outstandingPaise: number }>>(
    '/fees/outstanding',
    {},
    admin.accessToken,
  );
  const due = outstanding.find((d) => d.outstandingPaise > 0);
  if (due) {
    await json('/fees/payments', {
      method: 'POST',
      body: JSON.stringify({
        feeDemandId: due.id,
        amountPaise: Math.min(due.outstandingPaise, 100000),
        method: 'UPI',
        reference: `E2E-${stamp}`,
      }),
    }, admin.accessToken);
  }

  const exams = await json<Array<{ id: string; name: string }>>('/exams', {}, admin.accessToken);
  const exam = exams[0];
  if (exam) {
    await json(`/exams/${exam.id}/publish`, { method: 'POST' }, admin.accessToken);
  }

  const parent = await json<{ accessToken: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'parent@bharatvidya.edu', password: 'Password123!' }),
  });
  const children = await json<Array<{ admissionNo: string }>>(
    '/students/my-children',
    {},
    parent.accessToken,
  );
  if (!children.some((c) => c.admissionNo === 'ADM-8001')) {
    throw new Error('Parent should see ADM-8001');
  }
  if (children.some((c) => c.admissionNo === 'ADM-8002')) {
    throw new Error('Parent must not see ADM-8002');
  }

  console.log('daily-loop-check OK', {
    student: student.id,
    paid: Boolean(due),
    exam: exam?.name,
    parentChildren: children.map((c) => c.admissionNo),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
