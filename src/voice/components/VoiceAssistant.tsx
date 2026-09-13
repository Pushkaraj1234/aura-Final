import { useEffect, useState, type FormEvent } from "react";
import { useVoiceAssistant } from "../useVoiceAssistant";
import { getStrings } from "../lib/i18n";
import {
  CONSENT_STORAGE_KEY,
  FALLBACK_CONFIG,
  LANGUAGE_STORAGE_KEY,
  VOICE_ENABLED,
  httpUrl,
  safeStorage,
} from "../lib/voiceConfig";
import type { VoiceConfig } from "../lib/voiceTypes";
import { LanguageSelect } from "./LanguageSelect";
import { SafetyPanel } from "./SafetyPanel";
import { MuteButton } from "./MuteButton";
import { VoiceButton } from "./VoiceButton";
import { VoiceConsent } from "./VoiceConsent";
import { VoiceOrb } from "./VoiceOrb";
import { VoiceStatus } from "./VoiceStatus";
import { VoiceTranscript } from "./VoiceTranscript";
import "../voice.css";

interface StoredConsent {
  storeTranscript: boolean;
}

function readConsent(): StoredConsent | null {
  try {
    const raw = safeStorage.get(CONSENT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredConsent) : null;
  } catch {
    return null;
  }
}

export function VoiceAssistant() {
  const [config, setConfig] = useState<VoiceConfig>(FALLBACK_CONFIG);
  const [consent, setConsent] = useState<StoredConsent | null>(readConsent);
  const [language, setLanguage] = useState(
    () => safeStorage.get(LANGUAGE_STORAGE_KEY) ?? FALLBACK_CONFIG.defaultLanguage
  );
  const [captions, setCaptions] = useState(true);
  const [draft, setDraft] = useState("");
  // Whether the backend answered when the page opened. Used to warn, never to
  // hide the button: on a free instance the backend sleeps after a quiet
  // period and the first request wakes it, so "did not answer just now" and
  // "will not work" are different things.
  const [reachable, setReachable] = useState<"checking" | "yes" | "no">("checking");

  const strings = getStrings(language);
  const voice = useVoiceAssistant({ language, storeTranscript: consent?.storeTranscript ?? false });
  const active = voice.status !== "idle" && voice.status !== "error";

  useEffect(() => {
    if (!VOICE_ENABLED) return;
    let cancelled = false;
    fetch(httpUrl("/voice/config"))
      .then((r) => (r.ok ? (r.json() as Promise<VoiceConfig>) : null))
      .then((c) => {
        if (cancelled) return;
        if (c) {
          setConfig(c);
          setReachable("yes");
        } else {
          setReachable("no");
        }
      })
      .catch(() => {
        if (!cancelled) setReachable("no");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function acceptConsent(choice: StoredConsent) {
    safeStorage.set(CONSENT_STORAGE_KEY, JSON.stringify(choice));
    setConsent(choice);
  }

  function changeLanguage(code: string) {
    setLanguage(code);
    safeStorage.set(LANGUAGE_STORAGE_KEY, code);
  }

  function submitText(event: FormEvent) {
    event.preventDefault();
    voice.sendText(draft);
    setDraft("");
  }

  // No backend configured. Say so plainly rather than showing a microphone
  // button that would fail the moment it was pressed — and do not imply
  // anyone is listening when nothing is connected.
  if (!VOICE_ENABLED) {
    return (
      <div className="aura-voice">
        <section className="voice-assistant">
          <header className="voice-header">
            <h2>{strings.title}</h2>
            <p>
              Talking out loud is not switched on for this deployment yet. Everything
              else works as usual: writing a check-in, messaging your counsellor, the
              emergency contacts.
            </p>
          </header>
        </section>
      </div>
    );
  }

  if (!consent) {
    return (
      // lang on the panel, not on <html>: only this part of the page is in the
      // chosen language, and mislabelling the whole document breaks how a
      // screen reader pronounces the rest of AURA.
      <div className="aura-voice" lang={language}>
        <div className="voice-assistant">
          <VoiceConsent
            strings={strings}
            transcriptStorageAvailable={config.transcriptStorageAvailable}
            retentionDays={config.transcriptRetentionDays}
            onAccept={acceptConsent}
          />
          <LanguageSelect
            value={language}
            languages={config.languages}
            label={strings.language}
            disabled={false}
            onChange={changeLanguage}
          />
        </div>
      </div>
    );
  }

  const ended =
    voice.endReason === "time_limit"
      ? strings.endedTimeLimit
      : voice.endReason === "idle"
        ? strings.endedIdle
        : null;

  return (
    <div className="aura-voice" lang={language}>
      <section className="voice-assistant" aria-labelledby="voice-title">
        <header className="voice-header">
          <h2 id="voice-title">{strings.title}</h2>
          <p>{strings.subtitle}</p>
        </header>

        <LanguageSelect
          value={language}
          languages={config.languages}
          label={strings.language}
          disabled={active}
          onChange={changeLanguage}
        />

        {voice.safety && (
          <SafetyPanel safety={voice.safety} strings={strings} onDismiss={voice.dismissSafety} />
        )}

        <VoiceOrb
          status={voice.status}
          interruptLabel={strings.interrupt}
          onInterrupt={voice.interrupt}
        />
        <VoiceStatus status={voice.status} error={voice.error} strings={strings} />
        {voice.muted && <p className="voice-notice is-muted-notice">{strings.mutedNotice}</p>}
        {ended && <p className="voice-notice">{ended}</p>}
        {reachable === "no" && (
          <p className="voice-notice">
            The voice service did not answer just now. It sleeps when nobody has used
            it for a while, so the first try can take about a minute to come back.
            Press the button and give it a moment.
          </p>
        )}
        {(voice.error === "quota_exceeded" || voice.error === "unsupported") && (
          <p className="voice-notice">{strings.textOption}</p>
        )}

        <div className="voice-controls">
          <VoiceButton
            active={active}
            onClick={active ? voice.stop : () => void voice.start()}
            startLabel={strings.start}
            stopLabel={strings.stop}
          />
          {/* Only while a conversation is running — muting a microphone that
              is not on would mean nothing. */}
          {active && (
            <MuteButton
              muted={voice.muted}
              onToggle={voice.toggleMute}
              muteLabel={strings.mute}
              unmuteLabel={strings.unmute}
            />
          )}
        </div>

        {active && (
          <form className="voice-text-form" onSubmit={submitText}>
            <label htmlFor="voice-text-input">{strings.typeLabel}</label>
            <div className="voice-text-row">
              {/* What someone types here is their own account of what happened,
                  so it is marked the same way every other first-person field in
                  AURA is: never sent to a machine-translation service. */}
              <input
                id="voice-text-input"
                value={draft}
                maxLength={2000}
                autoComplete="off"
                placeholder={strings.typePlaceholder}
                data-no-translate
                onChange={(e) => setDraft(e.target.value)}
              />
              <button type="submit" className="secondary-button" disabled={!draft.trim()}>
                {strings.send}
              </button>
            </div>
          </form>
        )}

        <VoiceTranscript
          messages={voice.messages}
          visible={captions}
          onToggle={() => setCaptions((v) => !v)}
          strings={strings}
        />
      </section>
    </div>
  );
}
