import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, VideoOff } from 'lucide-react';
import { EventSeverity, ProctorEvent, SensorMonitoringStats } from '../types';
import { AudioMeter, VideoFrameAnalyzer, VisionMetrics } from '../utils/audioVision';
import { CameraHelpPanel } from './CameraHelpPanel';

interface ProctorMonitorOverlayProps {
  videoStream: MediaStream | null;
  audioStream: MediaStream | null;
  screenStream?: MediaStream | null;
  screenMode?: 'display_stream' | 'window_focus_proctor' | null;
  faceAbsenceGraceSeconds?: number;
  onLogEvent: (event: Omit<ProctorEvent, 'id' | 'timestamp'>) => void;
  onUpdateStats?: (stats: SensorMonitoringStats) => void;
  currentSeverity: EventSeverity;
}

export const ProctorMonitorOverlay: React.FC<ProctorMonitorOverlayProps> = ({
  videoStream,
  audioStream,
  screenStream,
  screenMode = null,
  faceAbsenceGraceSeconds = 6,
  onLogEvent,
  onUpdateStats,
  currentSeverity,
}) => {
  // Start collapsed on phones so the preview doesn't cover the questions
  const [isMinimized, setIsMinimized] = useState(() => window.innerWidth < 640);
  const [faceDetected, setFaceDetected] = useState(true);
  const [isObstructed, setIsObstructed] = useState(false);
  const [audioLevel, setAudioLevel] = useState(-50);
  const [screenActive, setScreenActive] = useState(!!screenStream);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [detectionIssueDurationSec, setDetectionIssueDurationSec] = useState<number>(0);
  const [liveMetrics, setLiveMetrics] = useState<VisionMetrics | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const analyzerRef = useRef<VideoFrameAnalyzer | null>(null);
  const audioMeterRef = useRef<AudioMeter | null>(null);
  const faceAbsenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const windowBlurTimerRef = useRef<number | null>(null);
  const issueStartTimeRef = useRef<number | null>(null);

  // Sensor statistics accumulation refs
  const sessionStartTimeRef = useRef<number>(Date.now());
  const totalFramesRef = useRef<number>(0);
  const faceDetectedFramesRef = useRef<number>(0);
  const centerPoseFramesRef = useRef<number>(0);
  const luminanceSumRef = useRef<number>(0);
  const blackScreenFramesRef = useRef<number>(0);
  const obstructionEventsRef = useRef<number>(0);
  const multiplePersonsEventsRef = useRef<number>(0);

  const totalAudioSamplesRef = useRef<number>(0);
  const volumeSumRef = useRef<number>(0);
  const peakVolumeRef = useRef<number>(-90);
  const speechSamplesRef = useRef<number>(0);

  const windowBlurCountRef = useRef<number>(0);
  const tabSwitchCountRef = useRef<number>(0);
  const totalBlurTimeRef = useRef<number>(0);
  const lastStatsEmitRef = useRef<number>(0);
  const lastMetricsEmitRef = useRef<number>(0);

  const handleRecalibrate = () => {
    if (analyzerRef.current) {
      analyzerRef.current = new VideoFrameAnalyzer();
    }
    if (faceAbsenceTimerRef.current) {
      clearTimeout(faceAbsenceTimerRef.current);
      faceAbsenceTimerRef.current = null;
    }
    issueStartTimeRef.current = null;
    setDetectionIssueDurationSec(0);
    onLogEvent({
      eventType: 'PROCTOR_RECALIBRATED',
      severity: 'GREEN',
      message: 'Camera detection restarted by participant.',
      source: 'camera-monitor',
      resolved: true,
    });
  };

  // Initialize analyzers
  useEffect(() => {
    analyzerRef.current = new VideoFrameAnalyzer();

    if (videoStream && videoRef.current) {
      videoRef.current.srcObject = videoStream;
    }

    if (audioStream) {
      const audioMeter = new AudioMeter();
      if (audioMeter.init(audioStream)) {
        audioMeterRef.current = audioMeter;
      }
    }

    return () => {
      if (audioMeterRef.current) audioMeterRef.current.cleanup();
    };
  }, [videoStream, audioStream]);

  // Monitor screenStream tracks
  useEffect(() => {
    if (screenStream) {
      setScreenActive(true);
      const videoTrack = screenStream.getVideoTracks()[0];
      if (videoTrack) {
        const handleEnded = () => {
          setScreenActive(false);
          onLogEvent({
            eventType: 'SCREEN_SHARE_STOPPED',
            severity: 'YELLOW',
            message: 'Screen sharing ended during the assessment.',
            source: 'screen-monitor',
            resolved: false,
          });
        };
        videoTrack.addEventListener('ended', handleEnded);
        return () => videoTrack.removeEventListener('ended', handleEnded);
      }
    } else {
      setScreenActive(false);
    }
  }, [screenStream, onLogEvent]);

  // Monitor Window Focus & Tab Switch events
  useEffect(() => {
    const handleBlur = () => {
      const startTime = Date.now();
      windowBlurCountRef.current += 1;
      onLogEvent({
        eventType: 'WINDOW_FOCUS_LOST',
        severity: 'YELLOW',
        message: 'The assessment window lost focus.',
        source: 'browser-focus',
        resolved: false,
      });

      windowBlurTimerRef.current = startTime;
    };

    const handleFocus = () => {
      const duration = windowBlurTimerRef.current
        ? Math.round((Date.now() - windowBlurTimerRef.current) / 1000)
        : 1;

      totalBlurTimeRef.current += duration;

      onLogEvent({
        eventType: 'WINDOW_FOCUS_RESTORED',
        severity: 'GREEN',
        message: `Returned to the assessment window after ${duration}s.`,
        source: 'browser-focus',
        durationSeconds: duration,
        resolved: true,
      });
      windowBlurTimerRef.current = null;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchCountRef.current += 1;
        onLogEvent({
          eventType: 'TAB_SWITCH',
          severity: 'ORANGE',
          message: 'The assessment tab was hidden or minimized.',
          source: 'browser-focus',
          resolved: false,
        });
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onLogEvent]);

  // Continuous Vision & Audio frame loop with statistics aggregation
  useEffect(() => {
    let animId: number;
    let lastEventSentTime = 0;

    const loop = () => {
      const now = Date.now();

      if (videoRef.current && analyzerRef.current && videoStream?.active) {
        const metrics = analyzerRef.current.analyzeFrame(videoRef.current);
        setFaceDetected((prev) => (prev !== metrics.faceDetected ? metrics.faceDetected : prev));
        setIsObstructed((prev) => (prev !== metrics.isObstructed ? metrics.isObstructed : prev));

        // Periodically update liveMetrics for the camera help panel (every 160ms)
        if (now - lastMetricsEmitRef.current > 160) {
          lastMetricsEmitRef.current = now;
          setLiveMetrics(metrics);
        }

        // Check if detection issues persist (face not detected, obstructed, or black screen)
        const hasIssue = !metrics.faceDetected || metrics.isObstructed || metrics.isBlackScreen;
        if (hasIssue) {
          if (!issueStartTimeRef.current) {
            issueStartTimeRef.current = now;
          }
          const durSec = Math.round((now - issueStartTimeRef.current) / 1000);
          setDetectionIssueDurationSec((prev) => (prev !== durSec ? durSec : prev));
        } else {
          issueStartTimeRef.current = null;
          setDetectionIssueDurationSec((prev) => (prev !== 0 ? 0 : prev));
        }

        // Accumulate vision telemetry
        totalFramesRef.current += 1;
        luminanceSumRef.current += metrics.luminance;
        if (metrics.faceDetected) {
          faceDetectedFramesRef.current += 1;
        }
        if (metrics.headPose === 'center') {
          centerPoseFramesRef.current += 1;
        }
        if (metrics.isBlackScreen) {
          blackScreenFramesRef.current += 1;
        }

        // Check face absence with the configured grace period
        if (!metrics.faceDetected && !metrics.isObstructed) {
          if (!faceAbsenceTimerRef.current && now - lastEventSentTime > 12000) {
            faceAbsenceTimerRef.current = setTimeout(() => {
              onLogEvent({
                eventType: 'FACE_NOT_DETECTED',
                severity: 'YELLOW',
                message: 'Face not in camera view.',
                source: 'camera-monitor',
                resolved: false,
              });
              lastEventSentTime = Date.now();
            }, faceAbsenceGraceSeconds * 1000);
          }
        } else {
          if (faceAbsenceTimerRef.current) {
            clearTimeout(faceAbsenceTimerRef.current);
            faceAbsenceTimerRef.current = null;
          }
        }

        // Camera obstruction detection
        if (metrics.isObstructed && now - lastEventSentTime > 15000) {
          obstructionEventsRef.current += 1;
          onLogEvent({
            eventType: 'CAMERA_OBSTRUCTED',
            severity: 'YELLOW',
            message: 'Camera appears covered, or the room is too dark.',
            source: 'camera-monitor',
            resolved: false,
          });
          lastEventSentTime = now;
        }

        // Multiple persons detection
        if (metrics.multiplePersonsSuspected && now - lastEventSentTime > 20000) {
          multiplePersonsEventsRef.current += 1;
          onLogEvent({
            eventType: 'MULTIPLE_PERSON_DETECTED',
            severity: 'ORANGE',
            message: 'Another person may have been in camera view.',
            source: 'camera-monitor',
            confidence: 0.88,
            resolved: false,
          });
          lastEventSentTime = now;
        }
      }

      // Audio decibel check & accumulation
      if (audioMeterRef.current) {
        const audioMetrics = audioMeterRef.current.getMetrics();
        setAudioLevel(audioMetrics.volumeDb);

        totalAudioSamplesRef.current += 1;
        volumeSumRef.current += audioMetrics.volumeDb;
        if (audioMetrics.volumeDb > peakVolumeRef.current) {
          peakVolumeRef.current = audioMetrics.volumeDb;
        }
        if (audioMetrics.isSpeaking) {
          speechSamplesRef.current += 1;
        }
      }

      // Periodically calculate and emit full sensor stats (every 1.5 seconds)
      if (now - lastStatsEmitRef.current > 1500 && onUpdateStats) {
        lastStatsEmitRef.current = now;
        const durationSec = Math.max(1, Math.round((now - sessionStartTimeRef.current) / 1000));
        const totalF = Math.max(1, totalFramesRef.current);
        const faceRetPct = Math.min(100, Math.round((faceDetectedFramesRef.current / totalF) * 100));
        const centerPosePct = Math.min(100, Math.round((centerPoseFramesRef.current / totalF) * 100));
        const avgLum = Math.round(luminanceSumRef.current / totalF);

        const totalAudioS = Math.max(1, totalAudioSamplesRef.current);
        const avgVolDb = Math.round(volumeSumRef.current / totalAudioS);
        const speechSec = Math.round((speechSamplesRef.current / totalAudioS) * durationSec);
        const ambientSilencePct = Math.max(
          0,
          Math.min(100, Math.round(((totalAudioS - speechSamplesRef.current) / totalAudioS) * 100))
        );

        const blurSec = totalBlurTimeRef.current;
        const focusPct = Math.max(0, Math.min(100, Math.round(((durationSec - blurSec) / durationSec) * 100)));

        const stats: SensorMonitoringStats = {
          sessionDurationSeconds: durationSec,
          totalFramesAnalyzed: totalFramesRef.current,
          faceDetectedFrames: faceDetectedFramesRef.current,
          faceRetentionPercentage: faceRetPct,
          centerPosePercentage: centerPosePct,
          averageLuminance: avgLum,
          blackScreenFrames: blackScreenFramesRef.current,
          obstructionEventsCount: obstructionEventsRef.current,
          multiplePersonsSuspectedCount: multiplePersonsEventsRef.current,
          totalAudioSamples: totalAudioSamplesRef.current,
          averageVolumeDb: avgVolDb,
          peakVolumeDb: Math.round(peakVolumeRef.current),
          speechActivitySeconds: speechSec,
          ambientSilencePercentage: ambientSilencePct,
          screenShareActive: screenActive && screenMode === 'display_stream',
          screenShareType: screenMode === 'display_stream' ? 'display_stream' : 'window_focus_proctor',
          windowFocusPercentage: focusPct,
          windowBlurEventsCount: windowBlurCountRef.current,
          tabSwitchCount: tabSwitchCountRef.current,
          totalBlurDurationSeconds: blurSec,
        };

        onUpdateStats(stats);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      if (faceAbsenceTimerRef.current) clearTimeout(faceAbsenceTimerRef.current);
    };
  }, [videoStream, onLogEvent, onUpdateStats, screenActive, screenMode, faceAbsenceGraceSeconds]);

  const severity: Record<EventSeverity, { dot: string; label: string }> = {
    GREEN: { dot: 'bg-emerald-500', label: 'Session running normally' },
    YELLOW: { dot: 'bg-amber-400', label: 'Brief interruption noted' },
    ORANGE: { dot: 'bg-amber-500', label: 'Interruption noted' },
    RED: { dot: 'bg-rose-500', label: 'Session could not be confirmed' },
  };

  const cameraStatus = !videoStream?.active
    ? 'Camera off'
    : isObstructed
    ? 'Camera covered or too dark'
    : faceDetected
    ? 'You are in view'
    : 'Face not in view';
  const hasPersistentIssue = detectionIssueDurationSec >= 3;

  return (
    <aside aria-label="Session monitor" className="fixed bottom-4 right-4 z-30">
      <div
        className={`overflow-hidden rounded-xl border border-stone-200 bg-white shadow-md transition-[width] ${
          isMinimized ? 'w-48' : 'w-64'
        }`}
      >
        <div className="flex items-center justify-between px-3 py-2">
          <span className="flex items-center gap-2 text-xs font-medium text-stone-800" title={severity[currentSeverity].label}>
            <span className={`h-2 w-2 rounded-full ${severity[currentSeverity].dot}`} aria-hidden="true" />
            Camera and microphone on
            <span className="sr-only">. {severity[currentSeverity].label}</span>
          </span>
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            aria-label={isMinimized ? 'Show camera preview' : 'Hide camera preview'}
            aria-expanded={!isMinimized}
            className="rounded p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
          >
            {isMinimized ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>

        {/* Stays mounted when collapsed: the monitoring loop reads frames from this element */}
        <div className={isMinimized ? 'hidden' : 'px-3'}>
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-stone-900">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              aria-label="Your camera"
              className="h-full w-full scale-x-[-1] object-cover"
            />
            {!videoStream?.active && (
              <div className="absolute inset-0 flex items-center justify-center gap-1.5 text-xs text-stone-300">
                <VideoOff className="h-4 w-4" aria-hidden="true" /> Camera off
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2 px-3 py-2.5 text-xs text-stone-600">
          <div className="flex items-center justify-between gap-2" role="status" aria-live="polite">
            <span className="truncate">{cameraStatus}</span>
            <span className="shrink-0 text-stone-500">
              {screenActive && screenMode === 'display_stream' ? 'Screen shared · ' : ''}
              {audioLevel > -40 ? 'Hearing you' : 'Quiet'}
            </span>
          </div>

          {hasPersistentIssue && (
            <p className="rounded-md bg-amber-50 px-2 py-1.5 text-amber-900">
              We can't see you clearly. Your answers so far are kept.
            </p>
          )}

          <button
            type="button"
            onClick={() => setIsDiagnosticOpen(true)}
            className="font-medium text-teal-800 underline-offset-2 hover:underline"
          >
            Camera help
          </button>
        </div>
      </div>

      <CameraHelpPanel
        isOpen={isDiagnosticOpen}
        onClose={() => setIsDiagnosticOpen(false)}
        videoStream={videoStream}
        metrics={liveMetrics}
        isObstructed={isObstructed}
        faceDetected={faceDetected}
        onRecalibrate={handleRecalibrate}
      />
    </aside>
  );
};
