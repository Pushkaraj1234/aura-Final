import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, RefreshCw, AlertTriangle, VideoOff } from 'lucide-react';
import { VideoFrameAnalyzer, VisionMetrics } from '../utils/audioVision';
import { StepHeader } from './StepHeader';

const CHECKS: { stage: 'CHECK_EYES_CENTER' | 'CHECK_SIDE_PROFILE' | 'CHECK_SOLITARY_ENV'; title: string; description: string }[] = [
  {
    stage: 'CHECK_EYES_CENTER',
    title: 'Look at the camera',
    description: 'Sit so your face is inside the outline and look straight ahead.',
  },
  {
    stage: 'CHECK_SIDE_PROFILE',
    title: 'Turn your head to one side',
    description: 'Slowly turn your head a little to the left or right, as if glancing at a window beside you.',
  },
  {
    stage: 'CHECK_SOLITARY_ENV',
    title: 'Turn back to the center',
    description: 'Face the camera again. Aura checks the lighting and that only one person is in view.',
  },
];

interface LivenessEnvironmentStepProps {
  videoStream: MediaStream | null;
  onComplete: () => void;
  onLogEvent: (type: string, message: string, severity: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED') => void;
}

type VerificationStage = 'CHECK_EYES_CENTER' | 'CHECK_SIDE_PROFILE' | 'CHECK_SOLITARY_ENV' | 'VERIFIED';

// Head turns are measured relative to the person's own straight-ahead position from check 1,
// so an off-center camera or uneven lighting doesn't make the check easier or harder.
const TURN_THRESHOLD = 0.28; // roughly a 25 to 30 degree turn
const RETURN_THRESHOLD = 0.16;

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

export const LivenessEnvironmentStep: React.FC<LivenessEnvironmentStepProps> = ({
  videoStream,
  onComplete,
  onLogEvent,
}) => {
  const [currentStage, setCurrentStage] = useState<VerificationStage>('CHECK_EYES_CENTER');

  // Real-time vision metrics
  const [metrics, setMetrics] = useState<VisionMetrics>({
    faceDetected: false,
    confidence: 0,
    isBlackScreen: true,
    isObstructed: true,
    isTooDark: true,
    luminance: 0,
    motionScore: 0,
    multiplePersonsSuspected: false,
    eyesDetected: false,
    leftEyeDetected: false,
    rightEyeDetected: false,
    headPose: 'unknown',
    yawScore: 0,
    faceBoundingBox: null,
    statusMessage: 'Initializing camera...',
  });

  // Individual progress for the 3 checks (0 to 100%)
  const [check1Progress, setCheck1Progress] = useState<number>(0);
  const [check2Progress, setCheck2Progress] = useState<number>(0);
  const [check3Progress, setCheck3Progress] = useState<number>(0);

  // Completed check statuses
  const [check1Done, setCheck1Done] = useState<boolean>(false);
  const [check2Done, setCheck2Done] = useState<boolean>(false);
  const [check3Done, setCheck3Done] = useState<boolean>(false);

  // Simulation mode for testing when physical camera is unavailable
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [participantAbsentAlert, setParticipantAbsentAlert] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const analyzerRef = useRef<VideoFrameAnalyzer | null>(null);
  const simCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const simStreamRef = useRef<MediaStream | null>(null);
  const faceAbsenceDurationRef = useRef<number>(0);
  const centerYawSamplesRef = useRef<number[]>([]);
  const baselineYawRef = useRef<number>(0);

  // Synchronized state refs to prevent executing setState inside render cycles
  const currentStageRef = useRef<VerificationStage>(currentStage);
  const check1ProgressRef = useRef<number>(0);
  const check2ProgressRef = useRef<number>(0);
  const check3ProgressRef = useRef<number>(0);
  const check1DoneRef = useRef<boolean>(false);
  const check2DoneRef = useRef<boolean>(false);
  const check3DoneRef = useRef<boolean>(false);
  const onLogEventRef = useRef(onLogEvent);

  useEffect(() => {
    onLogEventRef.current = onLogEvent;
  }, [onLogEvent]);

  useEffect(() => {
    currentStageRef.current = currentStage;
  }, [currentStage]);

  // Setup video stream & analyzer
  useEffect(() => {
    analyzerRef.current = new VideoFrameAnalyzer();

    if (videoStream && videoRef.current && !isSimulating) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream, isSimulating]);

  // Synthetic feed generator (allows testing the 3 checks with realistic facial landmarks)
  useEffect(() => {
    if (!isSimulating) return;

    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    simCanvasRef.current = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let animId: number;

    let angle = 0; // current head turn in degrees, eased toward the target each frame

    const renderSim = () => {
      frame++;
      // Turn the head during check 2, face the camera otherwise
      const target = currentStageRef.current === 'CHECK_SIDE_PROFILE' ? 35 : 0;
      angle += (target - angle) * 0.08;
      const t = (angle * Math.PI) / 180;
      const s = Math.sin(t);

      ctx.fillStyle = '#3a4450';
      ctx.fillRect(0, 0, 320, 240);

      const cx = 160;
      const cy = 118;
      const R = 58;
      const RY = 80;

      // Hair, shifting toward the back of the head as it turns
      ctx.fillStyle = '#1e1610';
      ctx.beginPath();
      ctx.ellipse(cx - s * 18, cy - 18, R + 6, RY * 0.9, 0, Math.PI, Math.PI * 2);
      ctx.fill();

      // Face
      ctx.fillStyle = '#d99a78';
      ctx.beginPath();
      ctx.ellipse(cx, cy, R, RY, 0, 0, Math.PI * 2);
      ctx.fill();

      // Side of the head appears at the far edge, opposite the turn
      if (Math.abs(s) > 0.05) {
        ctx.fillStyle = '#1e1610';
        ctx.beginPath();
        ctx.ellipse(cx - Math.sign(s) * R * (1 - 0.18 * Math.abs(s)), cy - 12, R * 0.3 * Math.abs(s), RY * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Features sit on a sphere, so they slide sideways and foreshorten as the head turns
      const feature = (offset: number, draw: (x: number, visibility: number) => void) => {
        const a = t + offset;
        if (Math.cos(a) > 0.2) draw(cx + R * 0.95 * Math.sin(a), Math.cos(a));
      };

      for (const offset of [-0.55, 0.55]) {
        feature(offset, (x, vis) => {
          ctx.strokeStyle = '#2f2017';
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x - 11 * vis, cy - 22);
          ctx.lineTo(x + 11 * vis, cy - 24);
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.ellipse(x, cy - 10, 8.5 * vis, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#1a1410';
          ctx.beginPath();
          ctx.arc(x, cy - 10, 3.8 * Math.max(0.5, vis), 0, Math.PI * 2);
          ctx.fill();
        });
      }

      feature(0, (x) => {
        ctx.fillStyle = '#e8aa87';
        ctx.fillRect(x - 4, cy - 12, 8, 22);
        ctx.fillStyle = '#9e5a3c';
        ctx.beginPath();
        ctx.arc(x - 4, cy + 12, 2, 0, Math.PI * 2);
        ctx.arc(x + 4, cy + 12, 2, 0, Math.PI * 2);
        ctx.fill();
      });

      feature(0, (x, vis) => {
        ctx.strokeStyle = '#9c3d3d';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - 15 * vis, cy + 30);
        ctx.lineTo(x + 15 * vis, cy + 30);
        ctx.stroke();
      });

      animId = requestAnimationFrame(renderSim);
    };

    renderSim();

    try {
      const stream = canvas.captureStream(30);
      simStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (e) {
      console.warn('Canvas captureStream error:', e);
    }

    return () => {
      cancelAnimationFrame(animId);
      if (simStreamRef.current) {
        simStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isSimulating]);

  // Main real-time analysis and 3-step verification engine
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = () => {
      const now = performance.now();
      const deltaSec = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      if (videoRef.current && analyzerRef.current) {
        const vMetrics = analyzerRef.current.analyzeFrame(videoRef.current);
        setMetrics(vMetrics);

        const isFaceCurrentlyPresent = vMetrics.faceDetected && !vMetrics.isBlackScreen && !vMetrics.isObstructed;

        // REAL-TIME ABSENCE RESET: If participant leaves camera frame during ANY check
        if (!isFaceCurrentlyPresent) {
          faceAbsenceDurationRef.current += deltaSec;

          // If face is missing for > 1.2 seconds of continuous absence (allows natural blinks):
          if (faceAbsenceDurationRef.current > 1.2) {
            // If any test was passed or has progress, reset to Step 1 immediately!
            if (
              currentStageRef.current !== 'CHECK_EYES_CENTER' ||
              check1DoneRef.current ||
              check2DoneRef.current ||
              check3DoneRef.current ||
              check1ProgressRef.current > 0 ||
              check2ProgressRef.current > 0 ||
              check3ProgressRef.current > 0
            ) {
              currentStageRef.current = 'CHECK_EYES_CENTER';
              check1ProgressRef.current = 0;
              check2ProgressRef.current = 0;
              check3ProgressRef.current = 0;
              centerYawSamplesRef.current = [];
              check1DoneRef.current = false;
              check2DoneRef.current = false;
              check3DoneRef.current = false;

              setCurrentStage('CHECK_EYES_CENTER');
              setCheck1Done(false);
              setCheck2Done(false);
              setCheck3Done(false);
              setCheck1Progress(0);
              setCheck2Progress(0);
              setCheck3Progress(0);
              setParticipantAbsentAlert(true);
              onLogEventRef.current(
                'LIVENESS_RESET_ABSENCE',
                'Face moved out of view, so the camera checks restarted.',
                'YELLOW'
              );
            }
          }
        } else {
          // Face is present in frame
          faceAbsenceDurationRef.current = 0;
          setParticipantAbsentAlert((prev) => (prev ? false : prev));
        }

        // If the camera is black/blank/obstructed, FREEZE and decay progress
        if (vMetrics.isBlackScreen || vMetrics.isObstructed || !vMetrics.faceDetected) {
          const p1 = Math.max(0, check1ProgressRef.current - deltaSec * 30);
          if (p1 !== check1ProgressRef.current) {
            check1ProgressRef.current = p1;
            setCheck1Progress(p1);
          }
          const p2 = Math.max(0, check2ProgressRef.current - deltaSec * 30);
          if (p2 !== check2ProgressRef.current) {
            check2ProgressRef.current = p2;
            setCheck2Progress(p2);
          }
          const p3 = Math.max(0, check3ProgressRef.current - deltaSec * 30);
          if (p3 !== check3ProgressRef.current) {
            check3ProgressRef.current = p3;
            setCheck3Progress(p3);
          }
        } else {
          const stage = currentStageRef.current;

          // CHECK 1: Face & Eyes Alignment in Center
          if (stage === 'CHECK_EYES_CENTER') {
            const hasDualEyes = vMetrics.eyesDetected || (vMetrics.leftEyeDetected && vMetrics.rightEyeDetected);
            const hasAnyEyes = hasDualEyes || vMetrics.leftEyeDetected || vMetrics.rightEyeDetected;
            const isCenterLooking =
              vMetrics.faceDetected &&
              hasAnyEyes &&
              (vMetrics.headPose === 'center' || Math.abs(vMetrics.yawScore) < 0.30);

            if (isCenterLooking) {
              // Remember recent straight-ahead readings; their median becomes the baseline
              centerYawSamplesRef.current = [...centerYawSamplesRef.current.slice(-29), vMetrics.yawScore];
              const fillSpeed = hasDualEyes ? 1.5 : 2.5;
              const next = Math.min(100, check1ProgressRef.current + (deltaSec / fillSpeed) * 100);
              check1ProgressRef.current = next;
              setCheck1Progress(next);

              if (next >= 100 && !check1DoneRef.current) {
                baselineYawRef.current = median(centerYawSamplesRef.current);
                check1DoneRef.current = true;
                setCheck1Done(true);
                currentStageRef.current = 'CHECK_SIDE_PROFILE';
                setCurrentStage('CHECK_SIDE_PROFILE');
                onLogEventRef.current(
                  'LIVENESS_FACE_EYES_VERIFIED',
                  'Face and eyes seen at the center of the frame.',
                  'GREEN'
                );
              }
            } else {
              const next = Math.max(0, check1ProgressRef.current - deltaSec * 20);
              if (next !== check1ProgressRef.current) {
                check1ProgressRef.current = next;
                setCheck1Progress(next);
              }
            }
          }

          // CHECK 2: Side Profile (Head Turn)
          else if (stage === 'CHECK_SIDE_PROFILE') {
            const isProfileLooking =
              vMetrics.faceDetected && Math.abs(vMetrics.yawScore - baselineYawRef.current) >= TURN_THRESHOLD;

            if (isProfileLooking) {
              const next = Math.min(100, check2ProgressRef.current + (deltaSec / 1.2) * 100);
              check2ProgressRef.current = next;
              setCheck2Progress(next);

              if (next >= 100 && !check2DoneRef.current) {
                check2DoneRef.current = true;
                setCheck2Done(true);
                currentStageRef.current = 'CHECK_SOLITARY_ENV';
                setCurrentStage('CHECK_SOLITARY_ENV');
                onLogEventRef.current(
                  'LIVENESS_SIDE_PROFILE_VERIFIED',
                  'Head turn to the side seen.',
                  'GREEN'
                );
              }
            } else {
              const next = Math.max(0, check2ProgressRef.current - deltaSec * 20);
              if (next !== check2ProgressRef.current) {
                check2ProgressRef.current = next;
                setCheck2Progress(next);
              }
            }
          }

          // CHECK 3: Return to Center & Solitary Environment
          else if (stage === 'CHECK_SOLITARY_ENV') {
            const isBackInCenter =
              vMetrics.faceDetected &&
              Math.abs(vMetrics.yawScore - baselineYawRef.current) < RETURN_THRESHOLD &&
              vMetrics.luminance >= 30 &&
              vMetrics.luminance <= 245 &&
              !vMetrics.multiplePersonsSuspected;

            if (isBackInCenter) {
              const next = Math.min(100, check3ProgressRef.current + (deltaSec / 1.4) * 100);
              check3ProgressRef.current = next;
              setCheck3Progress(next);

              if (next >= 100 && !check3DoneRef.current) {
                check3DoneRef.current = true;
                setCheck3Done(true);
                currentStageRef.current = 'VERIFIED';
                setCurrentStage('VERIFIED');
                onLogEventRef.current(
                  'ENVIRONMENT_SOLITARY_VERIFIED',
                  'All three camera checks complete. Lighting was adequate and one person was in view.',
                  'GREEN'
                );
              }
            } else {
              const next = Math.max(0, check3ProgressRef.current - deltaSec * 20);
              if (next !== check3ProgressRef.current) {
                check3ProgressRef.current = next;
                setCheck3Progress(next);
              }
            }
          }
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isSimulating]);

  // Restart the full check
  const handleResetCheck = () => {
    currentStageRef.current = 'CHECK_EYES_CENTER';
    check1ProgressRef.current = 0;
    check2ProgressRef.current = 0;
    check3ProgressRef.current = 0;
    centerYawSamplesRef.current = [];
    check1DoneRef.current = false;
    check2DoneRef.current = false;
    check3DoneRef.current = false;

    setCurrentStage('CHECK_EYES_CENTER');
    setCheck1Progress(0);
    setCheck2Progress(0);
    setCheck3Progress(0);
    setCheck1Done(false);
    setCheck2Done(false);
    setCheck3Done(false);
    setParticipantAbsentAlert(false);
    faceAbsenceDurationRef.current = 0;
  };

  // Toggle between Camera Diagnostics Simulator and Physical Hardware Webcam with full test reset
  const handleToggleSimulator = () => {
    if (isSimulating) {
      // Switching from simulator back to HARDWARE WEBCAM
      setIsSimulating(false);
      if (simStreamRef.current) {
        simStreamRef.current.getTracks().forEach((t) => t.stop());
        simStreamRef.current = null;
      }
      if (videoStream && videoRef.current) {
        videoRef.current.srcObject = videoStream;
        videoRef.current.play().catch(() => {});
      }
      // RESET ALL TESTS COMPLETELY so user performs them live with hardware camera
      handleResetCheck();
      onLogEvent('SWITCH_TO_HARDWARE_WEBCAM', 'Switched back to the real camera. Camera checks restarted.', 'GREEN');
    } else {
      // Switching to Simulator
      setIsSimulating(true);
      handleResetCheck();
      onLogEvent('SWITCH_TO_SIMULATOR', 'Test video feed turned on (development only).', 'YELLOW');
    }
  };

  const isVerified = currentStage === 'VERIFIED';
  const stageIndex = CHECKS.findIndex((c) => c.stage === currentStage);
  const doneFlags = [check1Done, check2Done, check3Done];
  const activeProgress = isVerified
    ? 100
    : currentStage === 'CHECK_EYES_CENTER'
    ? check1Progress
    : currentStage === 'CHECK_SIDE_PROFILE'
    ? check2Progress
    : check3Progress;

  const prompt = metrics.isBlackScreen
    ? 'Camera image is dark'
    : !metrics.faceDetected
    ? 'Move so your face is inside the outline'
    : currentStage === 'CHECK_EYES_CENTER'
    ? metrics.eyesDetected
      ? 'Hold still'
      : 'Look straight at the camera'
    : currentStage === 'CHECK_SIDE_PROFILE'
    ? Math.abs(metrics.yawScore - baselineYawRef.current) >= TURN_THRESHOLD
      ? 'Hold that position'
      : 'Slowly turn your head to one side'
    : currentStage === 'CHECK_SOLITARY_ENV'
    ? 'Turn back to face the camera'
    : 'All checks complete';

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <StepHeader step={3} title="Camera check">
        Three short checks confirm that a person is present and on their own. They take about ten seconds.
        Video stays in your browser and is never uploaded or stored.
      </StepHeader>

      <div className="mb-6 grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col">
          <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl bg-stone-900">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              aria-label="Camera preview"
              className="h-full w-full scale-x-[-1] object-cover"
            />

            {metrics.isBlackScreen && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-stone-900/90 p-4 text-center">
                <VideoOff className="mb-2 h-6 w-6 text-stone-300" aria-hidden="true" />
                <p className="text-sm font-medium text-white">Your camera image is dark</p>
                <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-stone-300">
                  Open the camera's privacy cover, turn on a light, or check your system's camera privacy settings.
                </p>
              </div>
            )}

            {/* Face outline guide */}
            {!metrics.isBlackScreen && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div
                  className={`relative flex h-44 w-36 items-center justify-center rounded-[45px] border-2 transition-colors duration-300 ${
                    isVerified
                      ? 'border-emerald-400'
                      : !metrics.faceDetected
                      ? 'border-dashed border-white/40'
                      : 'border-white/80'
                  }`}
                >
                  {currentStage === 'CHECK_EYES_CENTER' && !isVerified && (
                    <div className="absolute inset-x-6 top-12 flex justify-between" aria-hidden="true">
                      {[metrics.leftEyeDetected, metrics.rightEyeDetected].map((seen, i) => (
                        <span
                          key={i}
                          className={`h-3 w-3 rounded-full border-2 transition-colors ${
                            metrics.faceDetected && seen ? 'border-emerald-400 bg-emerald-400/40' : 'border-white/40'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                  {isVerified && <CheckCircle2 className="h-10 w-10 text-emerald-400" aria-hidden="true" />}
                </div>
              </div>
            )}

            <div
              className="absolute inset-x-2.5 bottom-2.5 z-10 rounded-lg bg-stone-900/80 px-2 py-1.5 text-center text-xs font-medium text-white"
              aria-live="polite"
            >
              {prompt}
            </div>
          </div>

          {participantAbsentAlert && (
            <div role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
              <span>We lost sight of you, so the checks started again. Look at the camera to continue.</span>
            </div>
          )}

          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-stone-600">
              <span>{isVerified ? 'Checks complete' : `Check ${stageIndex + 1} of 3`}</span>
              <span className="font-medium text-stone-800">{Math.round(activeProgress)}%</span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-stone-200"
              role="progressbar"
              aria-label="Current check progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(activeProgress)}
            >
              <div
                className={`h-full transition-all duration-150 ${isVerified ? 'bg-emerald-500' : 'bg-teal-600'}`}
                style={{ width: `${activeProgress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-4">
          <ol className="space-y-3">
            {CHECKS.map((check, i) => {
              const done = doneFlags[i];
              const active = currentStage === check.stage;
              return (
                <li
                  key={check.stage}
                  aria-current={active ? 'step' : undefined}
                  className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                    active ? 'border-teal-600 bg-teal-50/60' : 'border-stone-200 bg-white'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      done ? 'bg-emerald-600 text-white' : active ? 'bg-teal-800 text-white' : 'bg-stone-200 text-stone-600'
                    }`}
                  >
                    {done ? <CheckCircle2 className="h-4 w-4" aria-label="Done" /> : i + 1}
                  </span>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${done || active ? 'text-stone-900' : 'text-stone-600'}`}>
                      {check.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{check.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={handleToggleSimulator}
              className="self-start text-xs font-medium text-stone-500 underline underline-offset-2 hover:text-stone-800"
            >
              {isSimulating ? 'Use real camera' : 'Use test video (development only)'}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-stone-200 pt-5">
        <button
          type="button"
          onClick={handleResetCheck}
          className="flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Start over
        </button>

        <button
          type="button"
          onClick={onComplete}
          disabled={!isVerified}
          id="proceed-to-trauma-exposure-btn"
          className="rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
};
