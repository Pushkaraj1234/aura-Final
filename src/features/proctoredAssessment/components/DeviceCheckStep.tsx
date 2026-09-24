import React, { useState, useRef, useEffect } from 'react';
import { Camera, Mic, Monitor, CheckCircle2, AlertTriangle, RefreshCw, VideoOff, ExternalLink, Loader2 } from 'lucide-react';
import { AudioMeter, VideoFrameAnalyzer } from '../utils/audioVision';
import { StepHeader } from './StepHeader';

interface DeviceCheckStepProps {
  onComplete: (mediaStreams: {
    videoStream: MediaStream | null;
    audioStream: MediaStream | null;
    screenStream: MediaStream | null;
    screenMode: 'display_stream' | 'window_focus_proctor' | null;
  }) => void;
  onLogEvent: (type: string, message: string, severity: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED') => void;
}

const StatusText: React.FC<{ tone: 'ok' | 'warn' | 'muted'; children: React.ReactNode }> = ({ tone, children }) => (
  <span
    className={`flex items-center gap-1 text-xs font-medium ${
      tone === 'ok' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : 'text-stone-500'
    }`}
  >
    {tone === 'ok' && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
    {tone === 'warn' && <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
    {children}
  </span>
);

export const DeviceCheckStep: React.FC<DeviceCheckStepProps> = ({ onComplete, onLogEvent }) => {
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'checking' | 'ready' | 'error'>('idle');
  const [micStatus, setMicStatus] = useState<'idle' | 'checking' | 'ready' | 'error'>('idle');
  const [screenStatus, setScreenStatus] = useState<'idle' | 'checking' | 'ready' | 'skipped'>('idle');
  const [screenShareType, setScreenShareType] = useState<'display_stream' | 'window_focus_proctor' | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isBlackScreen, setIsBlackScreen] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const screenPreviewRef = useRef<HTMLVideoElement | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioMeterRef = useRef<AudioMeter | null>(null);
  const analyzerRef = useRef<VideoFrameAnalyzer | null>(null);
  const syntheticScreenAnimRef = useRef<number | null>(null);

  // Request camera and microphone
  const requestMedia = async () => {
    setErrorMessage(null);
    setCameraStatus('checking');
    setMicStatus('checking');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: true,
      });

      videoStreamRef.current = stream;
      audioStreamRef.current = stream;

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }

      setCameraStatus('ready');
      setMicStatus('ready');

      const audioMeter = new AudioMeter();
      if (audioMeter.init(stream)) {
        audioMeterRef.current = audioMeter;
      }

      analyzerRef.current = new VideoFrameAnalyzer();

      onLogEvent('DEVICE_VERIFIED', 'Camera and microphone connected.', 'GREEN');
    } catch (err: any) {
      console.error('Media access error:', err);
      setCameraStatus('error');
      setMicStatus('error');
      setErrorMessage(
        "We couldn't access your camera or microphone. Check your browser permissions and try again."
      );
      onLogEvent('CAMERA_LOST', 'Camera or microphone permission was declined, or no device was found.', 'RED');
    }
  };

  // Continuous monitoring loop for audio level and camera brightness
  useEffect(() => {
    let animId: number;

    const monitor = () => {
      if (audioMeterRef.current) {
        const metrics = audioMeterRef.current.getMetrics();
        const pct = Math.min(100, Math.max(0, ((metrics.volumeDb + 65) / 60) * 100));
        setAudioLevel(pct);
      }

      if (videoPreviewRef.current && analyzerRef.current && cameraStatus === 'ready') {
        const vMetrics = analyzerRef.current.analyzeFrame(videoPreviewRef.current);
        setIsBlackScreen(vMetrics.isBlackScreen);
      }

      animId = requestAnimationFrame(monitor);
    };

    animId = requestAnimationFrame(monitor);
    return () => cancelAnimationFrame(animId);
  }, [cameraStatus]);

  // Request an OS-level screen share
  const requestScreenShare = async () => {
    setScreenError(null);
    setScreenStatus('checking');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setScreenError("This browser doesn't support screen sharing. You can use focus tracking instead.");
      setScreenStatus('idle');
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      screenStreamRef.current = screenStream;
      setScreenStatus('ready');
      setScreenShareType('display_stream');
      setScreenError(null);

      if (screenPreviewRef.current) {
        screenPreviewRef.current.srcObject = screenStream;
      }

      onLogEvent('SCREEN_SHARE_STARTED', 'Screen sharing started.', 'GREEN');

      screenStream.getVideoTracks()[0].onended = () => {
        setScreenStatus('idle');
        setScreenShareType(null);
        screenStreamRef.current = null;
        onLogEvent('SCREEN_SHARE_STOPPED', 'Screen sharing was stopped.', 'YELLOW');
      };
    } catch (err: any) {
      console.warn('Screen share error or policy rejection:', err);
      const errString = String(err?.message || err);
      const isIframePolicy =
        err.name === 'NotAllowedError' &&
        (errString.includes('Permissions Policy') ||
          errString.includes('display-capture') ||
          errString.includes('document is not permitted'));

      if (isIframePolicy) {
        setScreenError(
          'Your browser blocked screen sharing in this window. You can open Aura in a new tab and try again, or use focus tracking instead.'
        );
      } else if (err.name === 'NotAllowedError') {
        setScreenError('Screen sharing was cancelled. You can try again or use focus tracking instead.');
      } else {
        setScreenError("Screen sharing didn't start. You can try again or use focus tracking instead.");
      }
      setScreenStatus('idle');
    }
  };

  // Alternative to screen sharing: track window focus and tab switches only
  const enableWindowFocusProctoring = () => {
    setScreenError(null);
    setScreenStatus('checking');

    try {
      // A small preview stream that explains what focus tracking does
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 270;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        const render = () => {
          ctx.fillStyle = '#f5f5f4';
          ctx.fillRect(0, 0, 480, 270);
          ctx.textAlign = 'center';
          ctx.fillStyle = '#1c1917';
          ctx.font = '600 34px system-ui, sans-serif';
          ctx.fillText('Focus tracking is on', 240, 122);
          ctx.fillStyle = '#57534e';
          ctx.font = '24px system-ui, sans-serif';
          ctx.fillText('Aura notes if you leave', 240, 166);
          ctx.fillText('this window or tab.', 240, 198);

          syntheticScreenAnimRef.current = requestAnimationFrame(render);
        };
        render();

        const stream = canvas.captureStream(15);
        screenStreamRef.current = stream;

        if (screenPreviewRef.current) {
          screenPreviewRef.current.srcObject = stream;
        }
      }

      setScreenStatus('ready');
      setScreenShareType('window_focus_proctor');
      onLogEvent('SCREEN_SHARE_STARTED', 'Focus tracking turned on instead of screen sharing.', 'GREEN');
    } catch (e) {
      console.error('Failed to create focus monitor stream:', e);
      setScreenStatus('ready');
      setScreenShareType('window_focus_proctor');
    }
  };

  const handleStopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    if (syntheticScreenAnimRef.current) {
      cancelAnimationFrame(syntheticScreenAnimRef.current);
    }
    setScreenStatus('idle');
    setScreenShareType(null);
    onLogEvent('SCREEN_SHARE_STOPPED', 'Screen sharing was turned off.', 'YELLOW');
  };

  useEffect(() => {
    requestMedia();
    return () => {
      if (syntheticScreenAnimRef.current) cancelAnimationFrame(syntheticScreenAnimRef.current);
      if (audioMeterRef.current) audioMeterRef.current.cleanup();
    };
  }, []);

  // Attach the screen stream once its preview element is rendered
  useEffect(() => {
    if (screenStatus === 'ready' && screenStreamRef.current && screenPreviewRef.current) {
      screenPreviewRef.current.srcObject = screenStreamRef.current;
    }
  }, [screenStatus]);

  const handleProceed = () => {
    onComplete({
      videoStream: videoStreamRef.current,
      audioStream: audioStreamRef.current,
      screenStream: screenStreamRef.current,
      screenMode: screenStatus === 'ready' ? screenShareType : null,
    });
  };

  const isReady = cameraStatus === 'ready' && micStatus === 'ready';
  const secondaryButton =
    'flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 disabled:opacity-50';

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <StepHeader step={2} title="Check your camera and microphone">
        Aura uses your camera and microphone during the assessment instead of a human observer. Nothing is
        recorded, and video is analyzed in your browser.
      </StepHeader>

      {errorMessage && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
          <div className="flex-1">
            <p>{errorMessage}</p>
            <button
              type="button"
              onClick={requestMedia}
              className="mt-2 inline-flex items-center gap-1 font-semibold text-teal-800 underline-offset-2 hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
            </button>
          </div>
        </div>
      )}

      <div className="mb-6 grid gap-6 sm:grid-cols-2">
        {/* Camera */}
        <section className="rounded-xl border border-stone-200 bg-stone-50 p-4" aria-labelledby="camera-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="camera-heading" className="flex items-center gap-2 text-sm font-semibold text-stone-800">
              <Camera className="h-4 w-4 text-teal-700" aria-hidden="true" />
              Camera
            </h2>
            <div aria-live="polite">
              {cameraStatus === 'ready' && !isBlackScreen && <StatusText tone="ok">Working</StatusText>}
              {cameraStatus === 'ready' && isBlackScreen && <StatusText tone="warn">Image is dark</StatusText>}
              {cameraStatus === 'checking' && <StatusText tone="muted">Connecting…</StatusText>}
              {cameraStatus === 'error' && <StatusText tone="warn">Not available</StatusText>}
            </div>
          </div>

          <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-stone-900">
            <video
              ref={videoPreviewRef}
              autoPlay
              playsInline
              muted
              aria-label="Camera preview"
              className="h-full w-full scale-x-[-1] object-cover"
            />

            {cameraStatus === 'ready' && isBlackScreen && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-900/90 p-4 text-center">
                <VideoOff className="mb-2 h-6 w-6 text-stone-300" aria-hidden="true" />
                <p className="text-sm font-medium text-white">Your camera image is dark</p>
                <p className="mt-1 max-w-[240px] text-xs text-stone-300">
                  Open the camera's privacy cover or turn on a light.
                </p>
              </div>
            )}

            {cameraStatus === 'checking' && (
              <span className="absolute text-xs text-stone-400">Connecting to camera…</span>
            )}
            {cameraStatus === 'error' && <span className="absolute text-xs text-stone-300">No camera found</span>}
          </div>
        </section>

        <div className="space-y-4">
          {/* Microphone */}
          <section className="rounded-xl border border-stone-200 bg-stone-50 p-4" aria-labelledby="mic-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="mic-heading" className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                <Mic className="h-4 w-4 text-teal-700" aria-hidden="true" />
                Microphone
              </h2>
              {micStatus === 'ready' && <StatusText tone="ok">Working</StatusText>}
            </div>

            <div className="mb-1 flex justify-between text-xs text-stone-600">
              <span id="mic-level-label">Input level</span>
              <span>{audioLevel > 15 ? 'Hearing you' : 'Quiet'}</span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-stone-200"
              role="meter"
              aria-labelledby="mic-level-label"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(audioLevel)}
            >
              <div className="h-full bg-teal-600 transition-all duration-100" style={{ width: `${audioLevel}%` }} />
            </div>
            <p className="mt-2 text-xs text-stone-500">Say a few words and check that the level moves.</p>
          </section>

          {/* Screen sharing */}
          <section className="rounded-xl border border-stone-200 bg-stone-50 p-4" aria-labelledby="screen-heading">
            <div className="mb-2 flex items-center justify-between">
              <h2 id="screen-heading" className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                <Monitor className="h-4 w-4 text-teal-700" aria-hidden="true" />
                Screen sharing
              </h2>
              {screenStatus === 'ready' ? (
                <StatusText tone="ok">{screenShareType === 'display_stream' ? 'Sharing' : 'Focus tracking on'}</StatusText>
              ) : screenStatus === 'checking' ? (
                <span className="flex items-center gap-1 text-xs text-stone-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Starting…
                </span>
              ) : (
                <span className="text-xs text-stone-500">Optional</span>
              )}
            </div>
            <p className="mb-3 text-xs leading-relaxed text-stone-600">
              Lets Aura notice if you switch to another window or tab. If you'd rather not share your screen, focus
              tracking does the same without showing your screen.
            </p>

            {screenStatus === 'ready' && (
              <div className="space-y-2">
                <div className="relative flex aspect-video max-h-32 w-full items-center justify-center overflow-hidden rounded-md border border-stone-200 bg-stone-100">
                  <video
                    ref={screenPreviewRef}
                    autoPlay
                    playsInline
                    muted
                    aria-label="Screen sharing preview"
                    className="h-full w-full object-contain"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleStopScreenShare}
                  className="text-xs font-medium text-stone-600 underline underline-offset-2 hover:text-stone-900"
                >
                  Stop
                </button>
              </div>
            )}

            {screenError && screenStatus !== 'ready' && (
              <div role="alert" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                {screenError}
              </div>
            )}

            {screenStatus !== 'ready' && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={requestScreenShare}
                  disabled={screenStatus === 'checking'}
                  className={secondaryButton}
                >
                  {screenError ? 'Try again' : 'Share screen'}
                </button>
                <button type="button" onClick={enableWindowFocusProctoring} className={secondaryButton}>
                  Use focus tracking
                </button>
                {screenError && (
                  <button
                    type="button"
                    onClick={() => window.open(window.location.href, '_blank')}
                    className={secondaryButton}
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    Open in new tab
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-5">
        <span className="text-sm text-stone-500" aria-live="polite">
          {isBlackScreen
            ? 'Your camera image is dark. Open the privacy cover to continue.'
            : isReady
            ? 'Camera and microphone are working.'
            : 'Waiting for camera and microphone…'}
        </span>
        <button
          type="button"
          onClick={handleProceed}
          disabled={!isReady}
          id="proceed-to-liveness-btn"
          className="rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
};
