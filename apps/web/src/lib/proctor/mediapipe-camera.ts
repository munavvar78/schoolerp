/**
 * Powerful on-device face proctor:
 * - MediaPipe FaceDetector + FaceLandmarker (ensemble)
 * - Browser FaceDetector when available
 * - Temporal smoothing (multi-frame voting) to cut false positives/negatives
 * - Landmark yaw/pitch for looking-away
 */

export type DetectorMode = 'mediapipe' | 'facedetector' | 'ensemble' | 'fallback';

export type CameraProctorSignal =
  | { type: 'CAMERA_OK'; faceCount: number; yaw: number | null; detectorMode: DetectorMode }
  | { type: 'CAMERA_FACE_MISSING'; faceCount: 0; detectorMode: DetectorMode }
  | { type: 'CAMERA_MULTI_FACE'; faceCount: number; detectorMode: DetectorMode }
  | { type: 'CAMERA_LOOKING_AWAY'; yaw: number; detectorMode: DetectorMode }
  | { type: 'CAMERA_FACE_MISSING_TIMEOUT'; absentMs: number; detectorMode: DetectorMode }
  | { type: 'CAMERA_DENIED' }
  | { type: 'CAMERA_STREAM_LOST' };

export type CameraProctorOptions = {
  faceAbsentSeconds?: number;
  minFaceAreaRatio?: number;
  lookingAwayYawDeg?: number;
  lookingAwayPitchDeg?: number;
  lookingAwayHoldMs?: number;
  /** Frames that must agree before state changes (smooths flicker). */
  smoothWindow?: number;
  onSignal: (signal: CameraProctorSignal) => void;
};

type FaceLandmarkerLike = {
  detectForVideo: (video: HTMLVideoElement, ts: number) => {
    faceLandmarks?: Array<Array<{ x: number; y: number; z: number }>>;
  };
  close: () => void;
};

type FaceDetectorLike = {
  detectForVideo: (video: HTMLVideoElement, ts: number) => {
    detections?: Array<{
      boundingBox?: { originX: number; originY: number; width: number; height: number };
      categories?: Array<{ score?: number }>;
    }>;
  };
  close: () => void;
};

type BrowserFaceDetector = {
  detect: (source: HTMLVideoElement | HTMLCanvasElement) => Promise<
    Array<{ boundingBox: { x: number; y: number; width: number; height: number } }>
  >;
};

const WASM_ROOTS = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm',
];

const DETECTOR_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
const LANDMARKER_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.tflite';

function estimateHeadPose(landmarks: Array<{ x: number; y: number; z: number }>): {
  yaw: number;
  pitch: number;
} | null {
  // MediaPipe Face Mesh indices
  const nose = landmarks[1];
  const chin = landmarks[152];
  const left = landmarks[33];
  const right = landmarks[263];
  const forehead = landmarks[10];
  if (!nose || !chin || !left || !right) return null;
  const midX = (left.x + right.x) / 2;
  const eyeSpan = Math.abs(right.x - left.x) || 0.001;
  const yaw = ((nose.x - midX) / eyeSpan) * 90;
  const faceH = Math.abs((forehead?.y ?? nose.y - 0.15) - chin.y) || 0.001;
  const midY = ((forehead?.y ?? nose.y - 0.12) + chin.y) / 2;
  const pitch = ((nose.y - midY) / faceH) * 90;
  return { yaw, pitch };
}

function analyzeFrameQuality(video: HTMLVideoElement): {
  presentLikely: boolean;
  skinRatio: number;
  mean: number;
  variance: number;
} {
  const canvas = document.createElement('canvas');
  const w = 160;
  const h = 120;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { presentLikely: true, skinRatio: 1, mean: 128, variance: 1000 };
  ctx.drawImage(video, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  let sum = 0;
  let sumSq = 0;
  let skin = 0;
  const n = w * h;
  // Center crop weights — faces usually sit in the middle of webcam
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const cx = x / w - 0.5;
      const cy = y / h - 0.5;
      const centerW = Math.exp(-(cx * cx + cy * cy) * 4);
      sum += luma * centerW;
      sumSq += luma * luma * centerW;
      const yCbCrCb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const yCbCrCr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      if (yCbCrCr > 133 && yCbCrCr < 173 && yCbCrCb > 77 && yCbCrCb < 127) {
        skin += centerW;
      }
    }
  }
  const weightSum = n; // approximate
  const mean = sum / weightSum;
  const variance = Math.max(0, sumSq / weightSum - mean * mean);
  const skinRatio = skin / weightSum;
  const presentLikely =
    mean > 25 &&
    mean < 245 &&
    variance > 120 &&
    skinRatio > 0.04;
  return { presentLikely, skinRatio, mean, variance };
}

type RawObservation = {
  faceCount: number;
  yaw: number | null;
  pitch: number | null;
};

export class MediaPipeCameraProctor {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private timer: number | null = null;
  private detector: FaceDetectorLike | null = null;
  private landmarker: FaceLandmarkerLike | null = null;
  private browserDetector: BrowserFaceDetector | null = null;
  private detectorMode: DetectorMode = 'fallback';
  private faceMissingSince: number | null = null;
  private lookingAwaySince: number | null = null;
  private lastTimeoutWarnedAt = 0;
  private lastMultiWarnedAt = 0;
  private lastAwayWarnedAt = 0;
  private running = false;
  private history: RawObservation[] = [];
  private readonly opts: Required<
    Pick<
      CameraProctorOptions,
      | 'faceAbsentSeconds'
      | 'minFaceAreaRatio'
      | 'lookingAwayYawDeg'
      | 'lookingAwayPitchDeg'
      | 'lookingAwayHoldMs'
      | 'smoothWindow'
    >
  > &
    CameraProctorOptions;

  constructor(options: CameraProctorOptions) {
    this.opts = {
      faceAbsentSeconds: options.faceAbsentSeconds ?? 10,
      minFaceAreaRatio: options.minFaceAreaRatio ?? 0.02,
      lookingAwayYawDeg: options.lookingAwayYawDeg ?? 25,
      lookingAwayPitchDeg: options.lookingAwayPitchDeg ?? 22,
      lookingAwayHoldMs: options.lookingAwayHoldMs ?? 2500,
      smoothWindow: options.smoothWindow ?? 5,
      onSignal: options.onSignal,
    };
  }

  getVideoElement() {
    return this.video;
  }

  getDetectorMode() {
    return this.detectorMode;
  }

  async start(videoEl?: HTMLVideoElement) {
    if (this.running) return;
    this.running = true;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24 },
        },
        audio: false,
      });
    } catch {
      this.opts.onSignal({ type: 'CAMERA_DENIED' });
      this.running = false;
      return;
    }

    this.video = videoEl ?? document.createElement('video');
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.autoplay = true;
    this.video.srcObject = this.stream;
    await this.video.play().catch(() => undefined);

    this.stream.getVideoTracks().forEach((track) => {
      track.addEventListener('ended', () => {
        this.opts.onSignal({ type: 'CAMERA_STREAM_LOST' });
        void this.stop();
      });
    });

    await this.initModels();
    this.scheduleTick();
  }

  async stop() {
    this.running = false;
    if (this.timer != null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.detector?.close();
    this.landmarker?.close();
    this.detector = null;
    this.landmarker = null;
    this.browserDetector = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    this.history = [];
  }

  private async initModels() {
    let mediapipeOk = false;
    try {
      const vision = await import('@mediapipe/tasks-vision');
      let fileset: Awaited<ReturnType<typeof vision.FilesetResolver.forVisionTasks>> | null = null;
      for (const root of WASM_ROOTS) {
        try {
          fileset = await vision.FilesetResolver.forVisionTasks(root);
          break;
        } catch {
          fileset = null;
        }
      }
      if (fileset) {
        for (const delegate of ['GPU', 'CPU'] as const) {
          try {
            this.detector = (await vision.FaceDetector.createFromOptions(fileset, {
              baseOptions: { modelAssetPath: DETECTOR_MODEL, delegate },
              runningMode: 'VIDEO',
              minDetectionConfidence: 0.45,
              minSuppressionThreshold: 0.3,
            })) as FaceDetectorLike;
            this.landmarker = (await vision.FaceLandmarker.createFromOptions(fileset, {
              baseOptions: { modelAssetPath: LANDMARKER_MODEL, delegate },
              runningMode: 'VIDEO',
              numFaces: 4,
              minFaceDetectionConfidence: 0.45,
              minFacePresenceConfidence: 0.45,
              minTrackingConfidence: 0.45,
              outputFaceBlendshapes: false,
              outputFacialTransformationMatrixes: false,
            })) as FaceLandmarkerLike;
            mediapipeOk = true;
            break;
          } catch {
            this.detector = null;
            this.landmarker = null;
          }
        }
      }
    } catch {
      mediapipeOk = false;
    }

    try {
      const FD = (
        window as unknown as {
          FaceDetector?: new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => BrowserFaceDetector;
        }
      ).FaceDetector;
      if (FD) {
        this.browserDetector = new FD({ fastMode: false, maxDetectedFaces: 4 });
      }
    } catch {
      this.browserDetector = null;
    }

    if (mediapipeOk && this.browserDetector) this.detectorMode = 'ensemble';
    else if (mediapipeOk) this.detectorMode = 'mediapipe';
    else if (this.browserDetector) this.detectorMode = 'facedetector';
    else this.detectorMode = 'fallback';
  }

  private scheduleTick() {
    if (!this.running) return;
    this.timer = window.setTimeout(() => {
      void this.tick();
    }, 180);
  }

  private async tick() {
    if (!this.running || !this.video) return;
    try {
      await this.analyzeFrame(performance.now());
    } catch {
      // keep loop alive
    }
    this.scheduleTick();
  }

  private pushObs(obs: RawObservation) {
    this.history.push(obs);
    if (this.history.length > this.opts.smoothWindow) this.history.shift();
  }

  private smoothed(): RawObservation {
    if (!this.history.length) return { faceCount: 0, yaw: null, pitch: null };
    // Majority vote on faceCount; median yaw/pitch among non-null
    const counts = this.history.map((h) => h.faceCount);
    const freq = new Map<number, number>();
    for (const c of counts) freq.set(c, (freq.get(c) ?? 0) + 1);
    let bestCount = 0;
    let bestVotes = -1;
    for (const [c, v] of freq) {
      if (v > bestVotes) {
        bestVotes = v;
        bestCount = c;
      }
    }
    const yaws = this.history.map((h) => h.yaw).filter((v): v is number => v != null).sort((a, b) => a - b);
    const pitches = this.history.map((h) => h.pitch).filter((v): v is number => v != null).sort((a, b) => a - b);
    const mid = (arr: number[]) => (arr.length ? arr[Math.floor(arr.length / 2)]! : null);
    return { faceCount: bestCount, yaw: mid(yaws), pitch: mid(pitches) };
  }

  private async analyzeFrame(ts: number) {
    const video = this.video!;
    if (video.readyState < 2) return;

    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const frameArea = Math.max(vw * vh, 1);

    let mpCount = 0;
    let brCount = 0;
    let yaw: number | null = null;
    let pitch: number | null = null;

    if (this.detector) {
      const det = this.detector.detectForVideo(video, ts);
      mpCount = (det.detections ?? []).filter((d) => {
        const b = d.boundingBox;
        if (!b) return false;
        const score = d.categories?.[0]?.score ?? 1;
        if (score < 0.4) return false;
        const area = (b.width * b.height) / frameArea;
        return area >= this.opts.minFaceAreaRatio;
      }).length;
    }

    if (this.landmarker) {
      const lm = this.landmarker.detectForVideo(video, ts);
      const faces = lm.faceLandmarks ?? [];
      if (faces.length > mpCount) mpCount = faces.length;
      const first = faces[0];
      if (first) {
        const pose = estimateHeadPose(first);
        if (pose) {
          yaw = pose.yaw;
          pitch = pose.pitch;
        }
      }
    }

    if (this.browserDetector) {
      try {
        const faces = await this.browserDetector.detect(video);
        brCount = faces.filter((f) => {
          const area = (f.boundingBox.width * f.boundingBox.height) / frameArea;
          return area >= this.opts.minFaceAreaRatio;
        }).length;
      } catch {
        brCount = 0;
      }
    }

    let faceCount = Math.max(mpCount, brCount);

    // Quality gate: if ML says 0 but pixels strongly look like a face, keep as 0
    // (don't invent faces). If ML says 1 but frame is black/covered, force 0.
    const quality = analyzeFrameQuality(video);
    if (faceCount > 0 && !quality.presentLikely && quality.mean < 22) {
      faceCount = 0;
    }
    if (faceCount === 0 && this.detectorMode === 'fallback') {
      faceCount = quality.presentLikely ? 1 : 0;
    }

    this.pushObs({ faceCount, yaw, pitch });
    const smooth = this.smoothed();

    if (smooth.faceCount === 0) {
      if (this.faceMissingSince == null) this.faceMissingSince = Date.now();
      const absentMs = Date.now() - this.faceMissingSince;
      this.opts.onSignal({
        type: 'CAMERA_FACE_MISSING',
        faceCount: 0,
        detectorMode: this.detectorMode,
      });
      if (
        absentMs >= this.opts.faceAbsentSeconds * 1000 &&
        Date.now() - this.lastTimeoutWarnedAt > 8_000
      ) {
        this.lastTimeoutWarnedAt = Date.now();
        this.faceMissingSince = Date.now();
        this.opts.onSignal({
          type: 'CAMERA_FACE_MISSING_TIMEOUT',
          absentMs,
          detectorMode: this.detectorMode,
        });
      }
      this.lookingAwaySince = null;
      return;
    }

    this.faceMissingSince = null;

    if (smooth.faceCount > 1) {
      if (Date.now() - this.lastMultiWarnedAt > 8_000) {
        this.lastMultiWarnedAt = Date.now();
        this.opts.onSignal({
          type: 'CAMERA_MULTI_FACE',
          faceCount: smooth.faceCount,
          detectorMode: this.detectorMode,
        });
      }
      return;
    }

    const awayYaw =
      smooth.yaw != null && Math.abs(smooth.yaw) >= this.opts.lookingAwayYawDeg;
    const awayPitch =
      smooth.pitch != null && Math.abs(smooth.pitch) >= this.opts.lookingAwayPitchDeg;
    if (awayYaw || awayPitch) {
      if (this.lookingAwaySince == null) this.lookingAwaySince = Date.now();
      if (
        Date.now() - this.lookingAwaySince >= this.opts.lookingAwayHoldMs &&
        Date.now() - this.lastAwayWarnedAt > 8_000
      ) {
        this.lastAwayWarnedAt = Date.now();
        this.lookingAwaySince = Date.now();
        this.opts.onSignal({
          type: 'CAMERA_LOOKING_AWAY',
          yaw: smooth.yaw ?? smooth.pitch ?? 0,
          detectorMode: this.detectorMode,
        });
      }
      return;
    }

    this.lookingAwaySince = null;
    this.opts.onSignal({
      type: 'CAMERA_OK',
      faceCount: smooth.faceCount,
      yaw: smooth.yaw,
      detectorMode: this.detectorMode,
    });
  }
}
