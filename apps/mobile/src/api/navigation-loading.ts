/**
 * Nav-scoped loading: show a progress indicator from tab/More navigation
 * until API requests started during that transition settle.
 */

type Listener = () => void;

const MIN_VISIBLE_MS = 280;
const GRACE_MS = 450;
const HIDE_DEBOUNCE_MS = 90;
const SAFETY_MS = 10_000;

let transitionOpen = false;
let transitionStartedAt = 0;
let trackedPending = 0;
let sawRequest = false;
let visible = false;

let graceTimer: ReturnType<typeof setTimeout> | null = null;
let settleTimer: ReturnType<typeof setTimeout> | null = null;
let safetyTimer: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

function clearTimer(timer: ReturnType<typeof setTimeout> | null) {
  if (timer) clearTimeout(timer);
}

function clearAllTimers() {
  clearTimer(graceTimer);
  clearTimer(settleTimer);
  clearTimer(safetyTimer);
  graceTimer = null;
  settleTimer = null;
  safetyTimer = null;
}

function setVisible(next: boolean) {
  if (visible === next) return;
  visible = next;
  notify();
}

function endTransition() {
  transitionOpen = false;
  trackedPending = 0;
  sawRequest = false;
  clearAllTimers();
  setVisible(false);
}

function scheduleHide() {
  if (!transitionOpen) return;
  if (trackedPending > 0) return;
  const elapsed = Date.now() - transitionStartedAt;
  const wait = Math.max(HIDE_DEBOUNCE_MS, MIN_VISIBLE_MS - elapsed);
  clearTimer(settleTimer);
  settleTimer = setTimeout(() => {
    settleTimer = null;
    if (!transitionOpen || trackedPending > 0) return;
    endTransition();
  }, wait);
}

function armSafety() {
  clearTimer(safetyTimer);
  safetyTimer = setTimeout(() => {
    safetyTimer = null;
    endTransition();
  }, SAFETY_MS);
}

function armGrace() {
  clearTimer(graceTimer);
  graceTimer = setTimeout(() => {
    graceTimer = null;
    if (!transitionOpen) return;
    if (!sawRequest && trackedPending === 0) {
      scheduleHide();
    }
  }, GRACE_MS);
}

/**
 * Start a navigation loading transition.
 * - `restart: true` (default): new tap — reset pending counts.
 * - `restart: false`: pathname caught up after a tap — keep in-flight counts.
 */
export function beginNavigationLoading(options?: { restart?: boolean }) {
  const restart = options?.restart ?? true;

  if (transitionOpen && !restart) {
    armSafety();
    setVisible(true);
    if (trackedPending === 0 && !sawRequest) {
      armGrace();
    } else if (trackedPending === 0 && sawRequest) {
      scheduleHide();
    }
    return;
  }

  clearAllTimers();
  transitionOpen = true;
  transitionStartedAt = Date.now();
  trackedPending = 0;
  sawRequest = false;
  setVisible(true);
  armSafety();
  armGrace();
}

/** Call when an API request starts; only counts during an open transition. */
export function trackNavigationRequestStart() {
  if (!transitionOpen) return;
  trackedPending += 1;
  sawRequest = true;
  clearTimer(settleTimer);
  settleTimer = null;
  setVisible(true);
}

/** Call when an API request finishes (success or error). */
export function trackNavigationRequestEnd() {
  if (!transitionOpen) return;
  trackedPending = Math.max(0, trackedPending - 1);
  if (trackedPending === 0 && sawRequest) {
    scheduleHide();
  }
}

export function isNavigationLoading(): boolean {
  return visible;
}

export function subscribeNavigationLoading(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
