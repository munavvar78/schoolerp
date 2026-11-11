'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { MediaPipeCameraProctor, type CameraProctorSignal } from '@/lib/proctor/mediapipe-camera';
import { BusyOverlay, Spinner } from '@/components/ui/spinner';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

type AttemptView = {
  id: string;
  status: string;
  expiresAt: string;
  warningCount: number;
  lockReasonCode: string | null;
  lockReasonMessage: string | null;
  score: number | null;
  maxScore: number | null;
};

type Question = {
  id: string;
  type?: string;
  stem: string;
  marks: number;
  options: Array<{ id: string; text: string }>;
};

function isMultiSelectType(type?: string) {
  return type === 'MULTIPLE_CHOICE';
}

type JoinResult = {
  accessToken: string;
  attempt: AttemptView;
  assessment: {
    id: string;
    title: string;
    durationMinutes: number;
    requireCamera: boolean;
    maxWarnings: number;
    faceAbsentSeconds: number;
    forbidTabSwitch: boolean;
  };
  student: { firstName: string; lastName?: string | null; admissionNo: string };
};

async function attemptFetch<T>(
  path: string,
  token: string,
  init?: RequestInit & { json?: unknown; keepalive?: boolean },
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init?.json !== undefined) headers.set('Content-Type', 'application/json');
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    keepalive: init?.keepalive ?? false,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof data === 'object' && data && 'message' in data
        ? Array.isArray(data.message)
          ? data.message.join(', ')
          : String(data.message)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export default function TakeExamPage() {
  const [phase, setPhase] = useState<'join' | 'ready' | 'exam' | 'done'>('join');
  const [joinCode, setJoinCode] = useState('');
  const [admissionNo, setAdmissionNo] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [meta, setMeta] = useState<JoinResult['assessment'] | null>(null);
  const [student, setStudent] = useState<JoinResult['student'] | null>(null);
  const [attempt, setAttempt] = useState<AttemptView | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [cameraStatus, setCameraStatus] = useState('Camera starting…');
  const [faceMissingSec, setFaceMissingSec] = useState(0);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [examFrozen, setExamFrozen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [autoSubmitReason, setAutoSubmitReason] = useState<string | null>(null);
  const [tabWarningOpen, setTabWarningOpen] = useState(false);
  const [tabAutoSubmitted, setTabAutoSubmitted] = useState(false);
  const [joining, setJoining] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const proctorRef = useRef<MediaPipeCameraProctor | null>(null);
  const startedRef = useRef(false);
  const tokenRef = useRef<string | null>(null);
  const tabReportBusy = useRef(false);
  const camReportBusy = useRef(false);
  const faceMissingSinceRef = useRef<number | null>(null);
  const attemptStatusRef = useRef<string>('IN_PROGRESS');
  const submitExamRef = useRef<(reason?: string) => Promise<void>>(async () => undefined);
  const tabGuardReadyAtRef = useRef(0);
  const tabWarnedOnceRef = useRef(false);
  const tabWarningOpenRef = useRef(false);
  const tabAutoSubmitStartedRef = useRef(false);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    attemptStatusRef.current = attempt?.status ?? 'IN_PROGRESS';
  }, [attempt?.status]);

  const applyAttempt = useCallback((next: AttemptView) => {
    setAttempt(next);
    if (next.status === 'LOCKED') {
      setBanner(next.lockReasonMessage ?? 'Exam locked');
      setPhase('exam');
    }
    if (next.status === 'SUBMITTED') {
      setPhase('done');
    }
  }, []);

  const reportProctor = useCallback(
    async (
      type: string,
      message?: string,
      metaObj?: Record<string, unknown>,
      channel: 'tab' | 'camera' = 'camera',
    ) => {
      const t = tokenRef.current;
      if (!t) return;
      const busy = channel === 'tab' ? tabReportBusy : camReportBusy;
      if (busy.current) return;
      busy.current = true;
      try {
        const res = await attemptFetch<{
          attempt: AttemptView;
          warningCount: number;
          maxWarnings?: number;
          locked: boolean;
          tabBlocked?: boolean;
        }>('/online-assessments/attempt/proctor-events', t, {
          method: 'POST',
          json: { type, message, meta: metaObj },
        });
        applyAttempt(res.attempt);
        if (res.tabBlocked) {
          setBanner('Tab switching is not allowed');
          return;
        }
        if (!res.locked && res.maxWarnings != null && res.warningCount > 0) {
          const isWarnType =
            type === 'CAMERA_FACE_MISSING_TIMEOUT' ||
            type === 'CAMERA_MULTI_FACE' ||
            type === 'CAMERA_LOOKING_AWAY';
          if (isWarnType) {
            setBanner(`Warning ${res.warningCount} of ${res.maxWarnings}: ${message ?? type}`);
          }
        }
        if (res.locked) {
          setBanner(res.attempt.lockReasonMessage ?? 'Exam locked');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Proctor event failed');
      } finally {
        busy.current = false;
      }
    },
    [applyAttempt],
  );

  async function joinExam(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setJoining(true);
    try {
      const res = await fetch(`${API_URL}/online-assessments/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          joinCode: joinCode.trim().toUpperCase(),
          admissionNo: admissionNo.trim(),
          pin: pin.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Join failed',
        );
      }
      const joined = data as JoinResult;
      setToken(joined.accessToken);
      setMeta(joined.assessment);
      setStudent(joined.student);
      applyAttempt(joined.attempt);
      if (joined.attempt.status === 'LOCKED') {
        setBanner(joined.attempt.lockReasonMessage);
        setPhase('exam');
        return;
      }
      if (joined.attempt.status === 'SUBMITTED') {
        setPhase('done');
        return;
      }
      setPhase('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Join failed');
    } finally {
      setJoining(false);
    }
  }

  async function startExam() {
    if (!token || !meta || starting) return;
    setError(null);
    setBanner(null);
    setExamFrozen(false);
    setAutoSubmitReason(null);
    setTabWarningOpen(false);
    setTabAutoSubmitted(false);
    tabWarnedOnceRef.current = false;
    tabWarningOpenRef.current = false;
    tabAutoSubmitStartedRef.current = false;
    setStarting(true);
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => undefined);
      }

      const payload = await attemptFetch<{
        attempt: AttemptView;
        questions: Question[];
        answers: Array<{ questionId: string; selectedOptionIds: string[] }>;
        assessment: JoinResult['assessment'];
      }>('/online-assessments/attempt/me', token);

      applyAttempt(payload.attempt);
      setQuestions(payload.questions);
      const map: Record<string, string[]> = {};
      payload.answers.forEach((a) => {
        map[a.questionId] = a.selectedOptionIds ?? [];
      });
      setAnswers(map);
      startedRef.current = true;
      // Ignore false tab/fullscreen events from starting fullscreen / camera for a moment
      tabGuardReadyAtRef.current = Date.now() + 3000;
      setCameraReady(false);
      setPhase('exam');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start exam');
    } finally {
      setStarting(false);
    }
  }

  // Start camera only after the exam <video> is mounted
  useEffect(() => {
    if (phase !== 'exam' || !startedRef.current || !meta || cameraReady) return;
    if (attemptStatusRef.current !== 'IN_PROGRESS') return;

    let cancelled = false;

    const boot = async () => {
      // wait one frame so videoRef is attached
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      if (cancelled) return;
      const video = videoRef.current;
      if (!video) {
        setError('Camera preview failed to mount — refresh and try again');
        return;
      }

      await proctorRef.current?.stop();
      const proctor = new MediaPipeCameraProctor({
        faceAbsentSeconds: meta.faceAbsentSeconds || 10,
        lookingAwayHoldMs: 3000,
        onSignal: (signal: CameraProctorSignal) => {
          if (attemptStatusRef.current !== 'IN_PROGRESS') return;

          if (signal.type === 'CAMERA_OK') {
            faceMissingSinceRef.current = null;
            setFaceMissingSec(0);
            setCameraStatus(
              `Face OK · ${signal.detectorMode}${signal.yaw != null ? ` · yaw ${signal.yaw.toFixed(0)}°` : ''}`,
            );
            return;
          }

          if (signal.type === 'CAMERA_FACE_MISSING') {
            if (faceMissingSinceRef.current == null) faceMissingSinceRef.current = Date.now();
            const sec = Math.floor((Date.now() - faceMissingSinceRef.current) / 1000);
            setFaceMissingSec(sec);
            setCameraStatus(`Face missing… ${sec}s / ${meta.faceAbsentSeconds || 10}s`);
            return;
          }

          if (signal.type === 'CAMERA_DENIED' || signal.type === 'CAMERA_STREAM_LOST') {
            setCameraStatus(signal.type);
            void reportProctor(signal.type, undefined, undefined, 'camera');
            return;
          }

          if (signal.type === 'CAMERA_FACE_MISSING_TIMEOUT') {
            setCameraStatus('Face missing too long — warning');
            void reportProctor(signal.type, 'Face not visible for too long', {
              absentMs: signal.absentMs,
              detectorMode: signal.detectorMode,
            }, 'camera');
            return;
          }

          if (signal.type === 'CAMERA_MULTI_FACE') {
            setCameraStatus(`Multiple faces (${signal.faceCount})`);
            void reportProctor(signal.type, 'Multiple faces detected', {
              faceCount: signal.faceCount,
              detectorMode: signal.detectorMode,
            }, 'camera');
            return;
          }

          if (signal.type === 'CAMERA_LOOKING_AWAY') {
            setCameraStatus('Looking away — warning');
            void reportProctor(signal.type, 'Looking away from screen', {
              yaw: signal.yaw,
              detectorMode: signal.detectorMode,
            }, 'camera');
          }
        },
      });
      proctorRef.current = proctor;
      await proctor.start(video);
      if (!cancelled) {
        setCameraReady(true);
        setCameraStatus(`Camera on · detector ${proctor.getDetectorMode()}`);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [phase, meta, cameraReady, reportProctor]);

  // Tab policy: first leave → Yes/No warning (no auto-submit); second leave → auto-submit.
  useEffect(() => {
    if (phase !== 'exam' || !startedRef.current) return;

    const handleTabLeave = (type: 'TAB_HIDDEN' | 'TAB_BLUR' | 'FULLSCREEN_EXIT') => {
      if (attemptStatusRef.current !== 'IN_PROGRESS' && attemptStatusRef.current !== 'SUBMITTING') {
        return;
      }
      if (Date.now() < tabGuardReadyAtRef.current) return;
      if (tabAutoSubmitStartedRef.current) return;
      // Ignore duplicate leave events while the first-warning dialog is open
      if (tabWarningOpenRef.current) return;

      if (!tabWarnedOnceRef.current) {
        // First leave: freeze answering and show Yes/No warning — do NOT submit yet
        tabWarningOpenRef.current = true;
        setTabWarningOpen(true);
        setExamFrozen(true);
        setBanner('WARNING: Tab switching is not allowed');
        void reportProctor(type, 'Tab leave — first warning shown', undefined, 'tab');
        return;
      }

      // Second leave after No: auto-submit immediately, no second chance
      tabAutoSubmitStartedRef.current = true;
      attemptStatusRef.current = 'SUBMITTING';
      setTabWarningOpen(false);
      tabWarningOpenRef.current = false;
      setTabAutoSubmitted(true);
      setExamFrozen(true);
      const reason =
        'You left the exam tab again after a warning. Your exam was submitted automatically.';
      setAutoSubmitReason(reason);
      setBanner(reason);
      void reportProctor(type, reason, undefined, 'tab');
      void submitExamRef.current(reason);
    };

    const onVis = () => {
      if (document.hidden) handleTabLeave('TAB_HIDDEN');
    };
    const onBlur = () => handleTabLeave('TAB_BLUR');
    const onPageHide = () => handleTabLeave('TAB_HIDDEN');
    const onFs = () => {
      if (!document.fullscreenElement) handleTabLeave('FULLSCREEN_EXIT');
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Best-effort block of common leave shortcuts (OS Alt+Tab cannot be blocked by web pages)
      const key = e.key.toLowerCase();
      if (
        (e.ctrlKey || e.metaKey) &&
        (key === 'tab' || key === 'w' || key === 't' || key === 'n' || key === 'pageup' || key === 'pagedown')
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleTabLeave('TAB_BLUR');
      }
      if (e.altKey && key === 'tab') {
        e.preventDefault();
        e.stopPropagation();
        handleTabLeave('TAB_BLUR');
      }
      if (key === 'f11' || (key === 'escape' && document.fullscreenElement)) {
        e.preventDefault();
        e.stopPropagation();
        if (key === 'escape') handleTabLeave('FULLSCREEN_EXIT');
      }
    };

    const focusPoll = window.setInterval(() => {
      if (attemptStatusRef.current !== 'IN_PROGRESS') return;
      if (Date.now() < tabGuardReadyAtRef.current) return;
      if (tabWarningOpenRef.current) return;
      if (typeof document.hasFocus === 'function' && !document.hasFocus()) {
        handleTabLeave('TAB_BLUR');
      }
      if (document.hidden) handleTabLeave('TAB_HIDDEN');
    }, 300);

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('fullscreenchange', onFs);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.clearInterval(focusPoll);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('fullscreenchange', onFs);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [phase, reportProctor]);

  // Timer + heartbeat
  useEffect(() => {
    if (phase !== 'exam' || !token || !attempt) return;
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000));
      setRemainingSec(left);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    const hb = window.setInterval(() => {
      void attemptFetch<{ attempt: AttemptView }>('/online-assessments/attempt/heartbeat', token, {
        method: 'POST',
      })
        .then((res) => applyAttempt(res.attempt))
        .catch(() => undefined);
    }, 20_000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(hb);
    };
  }, [phase, token, attempt, applyAttempt]);

  useEffect(() => {
    return () => {
      void proctorRef.current?.stop();
    };
  }, []);

  async function saveSingleAnswer(questionId: string, optionId: string) {
    if (!token || attempt?.status !== 'IN_PROGRESS') return;
    const selectedOptionIds = [optionId];
    setAnswers((prev) => ({ ...prev, [questionId]: selectedOptionIds }));
    setSavingQuestionId(questionId);
    try {
      await attemptFetch('/online-assessments/attempt/answers', token, {
        method: 'PUT',
        json: { answers: [{ questionId, selectedOptionIds }] },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingQuestionId((cur) => (cur === questionId ? null : cur));
    }
  }

  async function toggleMultiAnswer(questionId: string, optionId: string) {
    if (!token || attempt?.status !== 'IN_PROGRESS') return;
    const prev = answers[questionId] ?? [];
    const selectedOptionIds = prev.includes(optionId)
      ? prev.filter((id) => id !== optionId)
      : [...prev, optionId];
    setAnswers((prevMap) => ({ ...prevMap, [questionId]: selectedOptionIds }));
    setSavingQuestionId(questionId);
    try {
      await attemptFetch('/online-assessments/attempt/answers', token, {
        method: 'PUT',
        json: { answers: [{ questionId, selectedOptionIds }] },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingQuestionId((cur) => (cur === questionId ? null : cur));
    }
  }

  async function submitExam(reason?: string) {
    if (!token) return;
    if (attemptStatusRef.current === 'SUBMITTED') return;
    setError(null);
    setExamFrozen(true);
    setSubmitting(true);
    attemptStatusRef.current = 'SUBMITTING';
    if (reason) {
      setAutoSubmitReason(reason);
      setBanner(reason);
    }
    const trySubmit = async (keepalive: boolean) =>
      attemptFetch<AttemptView>('/online-assessments/attempt/submit', token, {
        method: 'POST',
        keepalive,
      });
    try {
      // keepalive so the request completes even after the student leaves the tab
      const res = await trySubmit(true);
      attemptStatusRef.current = 'SUBMITTED';
      applyAttempt(res);
      setTabWarningOpen(false);
      tabWarningOpenRef.current = false;
      setPhase('done');
      void proctorRef.current?.stop();
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => undefined);
      }
    } catch (err) {
      // Keep frozen forever on auto-submit — never unlock answering again
      setError(err instanceof Error ? err.message : 'Submit failed — retrying…');
      try {
        const res = await trySubmit(true);
        attemptStatusRef.current = 'SUBMITTED';
        applyAttempt(res);
        setTabWarningOpen(false);
        tabWarningOpenRef.current = false;
        setPhase('done');
        setError(null);
        void proctorRef.current?.stop();
      } catch {
        // Stay frozen + warning visible; retry while page is open
        window.setTimeout(() => {
          if (attemptStatusRef.current !== 'SUBMITTED') {
            void submitExamRef.current(reason);
          }
        }, 1500);
      }
    } finally {
      if (attemptStatusRef.current === 'SUBMITTED') setSubmitting(false);
    }
  }

  submitExamRef.current = submitExam;

  function confirmTabWarningSubmit() {
    tabWarningOpenRef.current = false;
    setTabWarningOpen(false);
    tabAutoSubmitStartedRef.current = true;
    void submitExam('Student confirmed submit after tab-switch warning.');
  }

  function dismissTabWarning() {
    // Mark first warning used; return to exam (one chance)
    tabWarnedOnceRef.current = true;
    tabWarningOpenRef.current = false;
    setTabWarningOpen(false);
    setExamFrozen(false);
    setBanner('You chose to continue. Leaving again will submit your exam automatically.');
    // Brief guard so focus/fullscreen restore does not immediately re-trigger leave
    tabGuardReadyAtRef.current = Date.now() + 1500;
    try {
      window.focus();
    } catch {
      /* ignore */
    }
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      void document.documentElement.requestFullscreen().catch(() => undefined);
    }
  }

  const locked = attempt?.status === 'LOCKED';
  const mm = remainingSec != null ? Math.floor(remainingSec / 60) : null;
  const ss = remainingSec != null ? remainingSec % 60 : null;
  const faceLimit = meta?.faceAbsentSeconds ?? 10;

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 px-4 py-8 text-slate-900"
      aria-busy={joining || starting || submitting || undefined}
    >
      <BusyOverlay open={joining} label="Joining exam…" />
      <BusyOverlay open={starting} label="Starting exam…" />
      <BusyOverlay open={submitting && phase !== 'done'} label="Submitting exam…" />
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">School ERP</p>
          <h1 className="text-2xl font-bold">Online exam</h1>
          <p className="text-sm text-slate-600">Enrollment-only access · no student account</p>
        </header>

        {error ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        ) : null}
        {banner ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
            {banner}
          </div>
        ) : null}

        {phase === 'join' ? (
          <form
            onSubmit={joinExam}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            aria-busy={joining || undefined}
          >
            <p className="text-sm text-slate-600">
              Enter the exam join code from your school and your admission number.
            </p>
            <label className="block text-sm">
              <span className="font-medium">Join code</span>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 disabled:opacity-60"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                required
                disabled={joining}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Admission number</span>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 disabled:opacity-60"
                value={admissionNo}
                onChange={(e) => setAdmissionNo(e.target.value)}
                required
                disabled={joining}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">PIN (if required)</span>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 disabled:opacity-60"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                disabled={joining}
              />
            </label>
            <button
              type="submit"
              disabled={joining}
              aria-busy={joining || undefined}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:pointer-events-none disabled:opacity-60"
            >
              {joining ? (
                <>
                  <Spinner size="sm" className="gap-0 [&_span]:border-teal-200 [&_span]:border-t-white" />
                  Joining…
                </>
              ) : (
                'Continue'
              )}
            </button>
          </form>
        ) : null}

        {phase === 'ready' && meta && student ? (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" aria-busy={starting || undefined}>
            <h2 className="text-xl font-semibold">{meta.title}</h2>
            <p className="text-sm text-slate-600">
              {student.firstName} {student.lastName ?? ''} · {student.admissionNo} ·{' '}
              {meta.durationMinutes} minutes
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-rose-800">
              <li>
                <strong>Tab switching is not allowed.</strong> Leaving this tab or window shows a{' '}
                <strong>WARNING</strong> with Yes/No: Yes submits now; No returns you to the exam
                (one chance). Leaving again after No <strong>auto-submits</strong> immediately.
              </li>
              <li>If your face is not visible for {meta.faceAbsentSeconds || 10} seconds, you get a warning.</li>
              <li>After 3 camera warnings the exam locks and shows the reason.</li>
              <li>Stay in fullscreen while the exam is running.</li>
            </ul>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:pointer-events-none disabled:opacity-60"
              onClick={() => void startExam()}
              disabled={starting}
              aria-busy={starting || undefined}
            >
              {starting ? (
                <>
                  <Spinner size="sm" className="gap-0 [&_span]:border-teal-200 [&_span]:border-t-white" />
                  Starting…
                </>
              ) : (
                'Start exam'
              )}
            </button>
          </div>
        ) : null}

        {phase === 'exam' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <p className="font-semibold">{meta?.title}</p>
                <p className="text-sm text-slate-600">
                  Time left:{' '}
                  {mm != null && ss != null
                    ? `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
                    : '—'}
                  {' · '}
                  Warnings: {attempt?.warningCount ?? 0}/{meta?.maxWarnings ?? 3}
                </p>
                <p className="text-xs text-slate-500">{cameraStatus}</p>
                {faceMissingSec > 0 ? (
                  <p className="mt-1 text-sm font-semibold text-amber-700">
                    Face not visible: {faceMissingSec}s (warning at {faceLimit}s)
                  </p>
                ) : null}
              </div>
              <video
                ref={videoRef}
                className="h-24 w-32 rounded-md border border-slate-300 bg-black object-cover"
                muted
                playsInline
                autoPlay
              />
            </div>

            {locked ? (
              <div className="rounded-xl border border-rose-300 bg-rose-50 p-6 text-rose-950">
                <h2 className="text-lg font-bold">Exam locked</h2>
                <p className="mt-2 text-sm">{attempt?.lockReasonMessage}</p>
                <p className="mt-2 text-xs text-rose-800">
                  Contact your teacher. They can unlock your attempt if allowed.
                </p>
              </div>
            ) : examFrozen && tabAutoSubmitted && !tabWarningOpen ? (
              <div className="rounded-xl border border-rose-400 bg-rose-50 p-6 text-rose-950">
                <h2 className="text-lg font-bold">Exam ended — you left again</h2>
                <p className="mt-2 text-sm">
                  {autoSubmitReason ??
                    'You left the exam tab again after a warning. Your exam was submitted automatically.'}
                </p>
                <p className="mt-2 text-xs text-rose-800">You cannot continue answering.</p>
              </div>
            ) : (
              <div
                className={`space-y-4 ${examFrozen ? 'pointer-events-none opacity-60' : ''}`}
                aria-disabled={examFrozen}
              >
                {questions.map((q, idx) => {
                  const multi = isMultiSelectType(q.type);
                  const selected = answers[q.id] ?? [];
                  const saving = savingQuestionId === q.id;
                  return (
                    <div
                      key={q.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                      aria-busy={saving || undefined}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium whitespace-pre-wrap">
                          Q{idx + 1}. {q.stem}{' '}
                          <span className="text-xs font-normal text-slate-500">
                            ({q.marks} mark{q.marks === 1 ? '' : 's'}
                            {multi ? ' · select all that apply' : ''})
                          </span>
                        </p>
                        {saving ? <Spinner size="sm" label="Saving…" className="shrink-0 text-slate-500" /> : null}
                      </div>
                      <div className="mt-3 space-y-2">
                        {q.options.map((opt) => (
                          <label key={opt.id} className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                              type={multi ? 'checkbox' : 'radio'}
                              name={q.id}
                              checked={selected.includes(opt.id)}
                              disabled={locked || examFrozen || submitting}
                              onChange={() =>
                                multi
                                  ? void toggleMultiAnswer(q.id, opt.id)
                                  : void saveSingleAnswer(q.id, opt.id)
                              }
                              className="accent-teal-700"
                            />
                            {opt.text}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 font-medium text-white disabled:pointer-events-none disabled:opacity-60"
                  onClick={() => void submitExam()}
                  disabled={locked || examFrozen || submitting}
                  aria-busy={submitting || undefined}
                >
                  {submitting ? (
                    <>
                      <Spinner size="sm" className="gap-0 [&_span]:border-slate-500 [&_span]:border-t-white" />
                      Submitting…
                    </>
                  ) : (
                    'Submit exam'
                  )}
                </button>
              </div>
            )}
          </div>
        ) : null}

        {tabWarningOpen ? (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="tab-leave-warning-title"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-rose-950/85 p-4 backdrop-blur-sm"
          >
            <div className="w-full max-w-lg rounded-2xl border-4 border-amber-400 bg-rose-700 px-6 py-8 text-center text-white shadow-2xl">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-300">Warning</p>
              <h2 id="tab-leave-warning-title" className="mt-3 text-2xl font-black leading-tight sm:text-3xl">
                WARNING: Tab switching is not allowed
              </h2>
              <p className="mt-4 text-base font-semibold text-rose-50">
                You must stay on this exam tab. Answering is frozen while this warning is open.
              </p>
              <p className="mt-3 text-sm text-rose-100/90">
                Do you want to submit your exam now? Choosing No gives you one chance to continue —
                leaving again will submit automatically.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  className="rounded-md bg-white px-5 py-2.5 text-sm font-bold text-rose-800 hover:bg-rose-50"
                  onClick={() => confirmTabWarningSubmit()}
                >
                  Yes — Submit exam now
                </button>
                <button
                  type="button"
                  className="rounded-md border-2 border-amber-300 bg-rose-900/40 px-5 py-2.5 text-sm font-bold text-amber-100 hover:bg-rose-900/70"
                  onClick={() => dismissTabWarning()}
                >
                  No — Return to exam (one chance)
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {phase === 'done' && attempt ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <h2 className="text-xl font-semibold">Submitted</h2>
            {autoSubmitReason ? (
              <p className="mt-2 text-sm font-medium text-rose-700">{autoSubmitReason}</p>
            ) : null}
            <p className="mt-2 text-slate-700">
              Score: {attempt.score ?? '—'}/{attempt.maxScore ?? '—'}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
