import React, { useEffect, useRef, useState } from 'react';
import { X, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { VisionMetrics } from '../utils/audioVision';

interface CameraHelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
  videoStream: MediaStream | null;
  metrics: VisionMetrics | null;
  isObstructed: boolean;
  faceDetected: boolean;
  onRecalibrate?: () => void;
}

/** Live camera preview with plain-language checks, opened from the session monitor. */
export const CameraHelpPanel: React.FC<CameraHelpPanelProps> = ({
  isOpen,
  onClose,
  videoStream,
  metrics,
  isObstructed,
  faceDetected,
  onRecalibrate,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [restarted, setRestarted] = useState(false);

  useEffect(() => {
    if (isOpen && videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [isOpen, videoStream]);

  // The parent re-renders many times a second, so keep the latest onClose in a ref
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    closeButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRestart = () => {
    onRecalibrate?.();
    setRestarted(true);
    setTimeout(() => setRestarted(false), 2500);
  };

  const luminance = metrics?.luminance ?? 0;
  const faceBox = metrics?.faceBoundingBox ?? null;
  const eyesVisible = !!(metrics?.eyesDetected || (metrics?.leftEyeDetected && metrics?.rightEyeDetected));

  const checks = [
    {
      id: 'lighting',
      title: 'Lighting',
      passed: luminance >= 38 && luminance <= 210,
      help:
        luminance < 38
          ? 'The room looks too dark. Try a lamp in front of you.'
          : luminance > 210
          ? 'The image is too bright. Avoid sitting with a window or light behind you.'
          : 'Lighting looks good.',
    },
    {
      id: 'framing',
      title: 'Face in view',
      passed: faceDetected && !!faceBox && Math.abs(faceBox.x + faceBox.width / 2 - 0.5) < 0.28,
      help: faceDetected ? 'Your face is in view.' : 'Sit directly in front of the camera.',
    },
    {
      id: 'eyes',
      title: 'Looking at the screen',
      passed: eyesVisible,
      help: eyesVisible ? 'Your eyes are visible.' : 'Look toward the screen with the camera at eye level.',
    },
    {
      id: 'lens',
      title: 'Camera uncovered',
      passed: !isObstructed && !metrics?.isBlackScreen,
      help:
        isObstructed || metrics?.isBlackScreen
          ? 'Something may be covering the camera. Check for a privacy cover or slider.'
          : 'Nothing is covering the camera.',
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-help-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 animate-fadeIn"
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h2 id="camera-help-title" className="text-base font-semibold text-stone-900">
            Camera help
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close camera help"
            className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid flex-1 gap-5 overflow-y-auto p-5 sm:grid-cols-2">
          <div>
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-stone-900">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                aria-label="Camera preview"
                className="h-full w-full scale-x-[-1] object-cover"
              />
              {faceBox && faceDetected && !isObstructed && (
                <div
                  className="pointer-events-none absolute rounded-lg border-2 border-white/80"
                  style={{
                    left: `${(1 - (faceBox.x + faceBox.width)) * 100}%`,
                    top: `${faceBox.y * 100}%`,
                    width: `${faceBox.width * 100}%`,
                    height: `${faceBox.height * 100}%`,
                  }}
                  aria-hidden="true"
                />
              )}
            </div>
            <p className="mt-2 text-xs text-stone-500">
              Video is analyzed in your browser. It is never uploaded or stored.
            </p>
          </div>

          <div>
            <ul className="space-y-3" aria-live="polite">
              {checks.map((check) => (
                <li key={check.id} className="flex items-start gap-2.5">
                  {check.passed ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="OK" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-label="Needs attention" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-stone-900">{check.title}</p>
                    <p className="text-xs leading-relaxed text-stone-600">{check.help}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-5 border-t border-stone-200 pt-4">
              <p className="mb-2 text-sm font-medium text-stone-900">Still having trouble?</p>
              <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-stone-600">
                <li>Close blinds or move away from a bright window behind you.</li>
                <li>Tilt your laptop screen so the camera is level with your eyes.</li>
                <li>Restart detection below if the picture looks right but checks don't update.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-stone-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleRestart}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {restarted ? 'Detection restarted' : 'Restart detection'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-teal-800 px-5 py-2 text-sm font-semibold text-white transition hover:bg-teal-900"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
