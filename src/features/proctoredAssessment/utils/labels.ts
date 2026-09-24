/**
 * Human-readable labels for internal event and rating codes.
 */

import { ProctorEvent, SessionIntegrityRating } from '../types';

export const INTEGRITY_LABELS: Record<SessionIntegrityRating, { label: string; description: string }> = {
  VERIFIED: {
    label: 'No issues',
    description: 'The session ran without interruptions.',
  },
  MINOR_SESSION_EVENTS: {
    label: 'Minor interruptions',
    description: 'There were brief interruptions, such as leaving the window or moving out of view.',
  },
  SIGNIFICANT_SESSION_EVENTS: {
    label: 'Several interruptions',
    description: 'The window lost focus or another person may have been in view more than once.',
  },
  UNABLE_TO_VERIFY: {
    label: 'Could not be confirmed',
    description: 'The camera or microphone was unavailable for part of the session.',
  },
};

const EVENT_LABELS: Record<string, string> = {
  SESSION_STARTED: 'Progress',
  DEVICE_VERIFIED: 'Camera and microphone connected',
  CAMERA_LOST: 'Camera unavailable',
  CAMERA_RESTORED: 'Camera reconnected',
  MICROPHONE_LOST: 'Microphone unavailable',
  MICROPHONE_RESTORED: 'Microphone reconnected',
  SCREEN_SHARE_STARTED: 'Screen sharing started',
  SCREEN_SHARE_STOPPED: 'Screen sharing stopped',
  SCREEN_SHARE_RESTORED: 'Screen sharing resumed',
  TAB_SWITCH: 'Switched tab',
  WINDOW_FOCUS_LOST: 'Left the window',
  WINDOW_FOCUS_RESTORED: 'Returned to the window',
  MULTIPLE_PERSON_DETECTED: 'Another person may be in view',
  FACE_NOT_DETECTED: 'Face not in view',
  FACE_RETURNED: 'Face back in view',
  CAMERA_OBSTRUCTED: 'Camera covered or too dark',
  CAMERA_CLEAR: 'Camera clear',
  PROCTOR_RECALIBRATED: 'Camera detection restarted',
  SESSION_PAUSED: 'Paused',
  SESSION_RESUMED: 'Resumed',
  ASSESSMENT_COMPLETED: 'Assessment completed',
  LIVENESS_FACE_EYES_VERIFIED: 'Camera check 1 complete',
  LIVENESS_SIDE_PROFILE_VERIFIED: 'Camera check 2 complete',
  ENVIRONMENT_SOLITARY_VERIFIED: 'Camera check complete',
  LIVENESS_RESET_ABSENCE: 'Camera check restarted',
};

const SOURCE_LABELS: Record<ProctorEvent['source'], string> = {
  'camera-monitor': 'Camera',
  'microphone-monitor': 'Microphone',
  'screen-monitor': 'Screen',
  'browser-focus': 'Browser',
  'user-action': 'You',
  system: 'Aura',
};

export function formatEventType(eventType: string): string {
  if (EVENT_LABELS[eventType]) return EVENT_LABELS[eventType];
  const words = eventType.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function formatEventSource(source: string): string {
  return SOURCE_LABELS[source as ProctorEvent['source']] ?? source;
}

/** Removes markdown syntax for plain-text output such as the PDF export. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|\s)\*(\S.*?)\*/g, '$1$2')
    .replace(/^\s*-{3,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
