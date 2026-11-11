const API = 'http://127.0.0.1:4000/api';

async function json(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

const login = await json('/auth/login', {
  method: 'POST',
  body: { email: 'admin@bharatvidya.edu', password: 'Password123!' },
});
const token = login.accessToken;
const sessions = await json('/academic/sessions', { token });
const grades = await json('/academic/grades', { token });
const sessionId = sessions[0].id;
const sectionId = grades[0].sections[0].id;

const assessment = await json('/online-assessments', {
  method: 'POST',
  token,
  body: {
    title: 'Smoke Quiz Multi Types',
    sessionId,
    durationMinutes: 30,
    status: 'LIVE',
    requireCamera: true,
    maxWarnings: 3,
    faceAbsentSeconds: 120,
    questions: [],
  },
});
console.log('created', assessment.joinCode);

const single = await json('/online-assessments/questions', {
  method: 'POST',
  token,
  body: {
    assessmentId: assessment.id,
    question: {
      type: 'SINGLE_CHOICE',
      stem: 'Capital of India?',
      marks: 2,
      sortOrder: 0,
      options: [
        { id: 'a', text: 'Mumbai', isCorrect: false },
        { id: 'b', text: 'New Delhi', isCorrect: true },
        { id: 'c', text: 'Kolkata', isCorrect: false },
        { id: 'd', text: 'Chennai', isCorrect: false },
      ],
    },
  },
});

const multi = await json('/online-assessments/questions', {
  method: 'POST',
  token,
  body: {
    assessmentId: assessment.id,
    question: {
      type: 'MULTIPLE_CHOICE',
      stem: 'Which are primary colors?',
      marks: 3,
      sortOrder: 1,
      options: [
        { id: 'r', text: 'Red', isCorrect: true },
        { id: 'g', text: 'Green', isCorrect: true },
        { id: 'b2', text: 'Blue', isCorrect: true },
        { id: 'y', text: 'Yellow', isCorrect: false },
      ],
    },
  },
});

const yesNo = await json('/online-assessments/questions', {
  method: 'POST',
  token,
  body: {
    assessmentId: assessment.id,
    question: {
      type: 'YES_NO',
      stem: 'Water freezes at 0°C?',
      marks: 1,
      sortOrder: 2,
      options: [
        { id: 'yes', text: 'Yes', isCorrect: true },
        { id: 'no', text: 'No', isCorrect: false },
      ],
    },
  },
});

const thisOrThat = await json('/online-assessments/questions', {
  method: 'POST',
  token,
  body: {
    assessmentId: assessment.id,
    question: {
      type: 'THIS_OR_THAT',
      stem: 'Pick the mammal',
      marks: 1,
      sortOrder: 3,
      options: [
        { id: 'this', text: 'Dolphin', isCorrect: true },
        { id: 'that', text: 'Shark', isCorrect: false },
      ],
    },
  },
});
console.log('questions', single.id, multi.id, yesNo.id, thisOrThat.id);

const enrolled = await json('/online-assessments/enroll-section', {
  method: 'POST',
  token,
  body: { assessmentId: assessment.id, sectionId },
});
console.log('enrolled', enrolled);

const students = await json('/students', { token });
const student = students[0];
if (!student) throw new Error('No students');

const join = await json('/online-assessments/join', {
  method: 'POST',
  body: { joinCode: assessment.joinCode, admissionNo: student.admissionNo },
});
console.log('joined', join.attempt.id, 'warnings', join.attempt.warningCount);
const attemptToken = join.accessToken;

const tab = await json('/online-assessments/attempt/proctor-events', {
  method: 'POST',
  token: attemptToken,
  body: { type: 'TAB_HIDDEN', message: 'Tab switching is not allowed — return to the exam tab' },
});
console.log('tabBlock', tab.tabBlocked, 'warnings', tab.warningCount, 'locked', tab.locked);
if (tab.locked || tab.warningCount !== 0 || !tab.tabBlocked) {
  throw new Error('Tab leave should block without warning/lock');
}

const w1 = await json('/online-assessments/attempt/proctor-events', {
  method: 'POST',
  token: attemptToken,
  body: { type: 'CAMERA_FACE_MISSING_TIMEOUT', message: 'Face not visible for too long' },
});
console.log('warn1', w1.warningCount, w1.locked);

const w2 = await json('/online-assessments/attempt/proctor-events', {
  method: 'POST',
  token: attemptToken,
  body: { type: 'CAMERA_MULTI_FACE', message: 'Multiple faces detected' },
});
console.log('warn2', w2.warningCount, w2.locked);

const w3 = await json('/online-assessments/attempt/proctor-events', {
  method: 'POST',
  token: attemptToken,
  body: { type: 'CAMERA_LOOKING_AWAY', message: 'Looking away from screen' },
});
console.log('warn3', w3.warningCount, w3.locked, w3.attempt.lockReasonCode);
if (!w3.locked || w3.attempt.lockReasonCode !== 'WARNINGS_EXCEEDED') {
  throw new Error('Expected lock after 3 warnings');
}
if (!String(w3.attempt.lockReasonMessage || '').includes('Face not visible')) {
  throw new Error('Lock reason missing details');
}

await json('/online-assessments/unlock', {
  method: 'POST',
  token,
  body: { attemptId: join.attempt.id, resetWarnings: true },
});

const me = await json('/online-assessments/attempt/me', { token: attemptToken });
const byStem = Object.fromEntries(me.questions.map((q) => [q.stem, q]));

await json('/online-assessments/attempt/answers', {
  method: 'PUT',
  token: attemptToken,
  body: {
    answers: [
      { questionId: byStem['Capital of India?'].id, selectedOptionIds: ['b'] },
      {
        questionId: byStem['Which are primary colors?'].id,
        selectedOptionIds: ['r', 'g', 'b2'],
      },
      { questionId: byStem['Water freezes at 0°C?'].id, selectedOptionIds: ['yes'] },
      { questionId: byStem['Pick the mammal'].id, selectedOptionIds: ['this'] },
    ],
  },
});

const submitted = await json('/online-assessments/attempt/submit', {
  method: 'POST',
  token: attemptToken,
});
console.log('submitted score', submitted.score, '/', submitted.maxScore);
if (submitted.score !== 7) throw new Error(`Expected score 7, got ${submitted.score}`);
if (submitted.maxScore !== 7) throw new Error(`Expected maxScore 7, got ${submitted.maxScore}`);

// Partial multi-correct should score 0 for that question — new attempt via second student if available
const student2 = students[1];
if (student2) {
  const assessment2 = await json('/online-assessments', {
    method: 'POST',
    token,
    body: {
      title: 'Smoke Multi Partial',
      sessionId,
      durationMinutes: 15,
      status: 'LIVE',
      requireCamera: false,
      maxWarnings: 3,
      faceAbsentSeconds: 10,
      questions: [
        {
          type: 'MULTIPLE_CHOICE',
          stem: 'Pick A and B',
          marks: 5,
          sortOrder: 0,
          options: [
            { id: 'a', text: 'A', isCorrect: true },
            { id: 'b', text: 'B', isCorrect: true },
            { id: 'c', text: 'C', isCorrect: false },
          ],
        },
      ],
    },
  });
  await json('/online-assessments/enroll-section', {
    method: 'POST',
    token,
    body: { assessmentId: assessment2.id, sectionId },
  });
  const join2 = await json('/online-assessments/join', {
    method: 'POST',
    body: { joinCode: assessment2.joinCode, admissionNo: student2.admissionNo },
  });
  const me2 = await json('/online-assessments/attempt/me', { token: join2.accessToken });
  await json('/online-assessments/attempt/answers', {
    method: 'PUT',
    token: join2.accessToken,
    body: {
      answers: [{ questionId: me2.questions[0].id, selectedOptionIds: ['a'] }],
    },
  });
  const submitted2 = await json('/online-assessments/attempt/submit', {
    method: 'POST',
    token: join2.accessToken,
  });
  if (submitted2.score !== 0) {
    throw new Error(`Partial multi should be 0, got ${submitted2.score}`);
  }
  console.log('partial multi ok');

  await json('/online-assessments/delete', {
    method: 'POST',
    token,
    body: { assessmentId: assessment2.id },
  });
  console.log('delete ok');
}

await json('/online-assessments/settings', {
  method: 'POST',
  token,
  body: {
    assessmentId: assessment.id,
    requireCamera: false,
    maxWarnings: 5,
    faceAbsentSeconds: 15,
  },
});
console.log('settings ok');

console.log('SMOKE_OK');
