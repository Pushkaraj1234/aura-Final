import React, { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, Pause, Play, Trash2 } from "lucide-react";
import {
  voiceRecordingStore,
  type VoiceRecording,
} from "../services/voiceRecordings";
import { ConfirmDialog } from "./ConfirmDialog";

/**
 * The recordings a person chose to keep, played back by them and nobody else.
 *
 * Before this, "Keep the recording afterwards" was a switch with nothing
 * behind it: the recorder made an object URL that died with the browser tab,
 * so there was no such thing as a previous recording to look at. This is the
 * other half of that switch.
 *
 * DELIBERATELY SMALL
 *
 * It sits in a sidebar column alongside the session request, so it is a
 * compact list rather than a media library: date, length, play, delete. The
 * transcript is there but folded away, because most of the time somebody
 * opening this wants to hear the thing, not read it again.
 *
 * NOTHING IS SHOWN THAT IS NOT KEPT
 *
 * When the consent is off the card says so and offers no list, rather than
 * rendering an empty box that looks like a fault. When it is on and there is
 * nothing yet, it says that instead.
 *
 * ONE PLAYER, NOT ONE PER ROW
 *
 * A single audio element is reused, so starting a second recording stops the
 * first. Two of a person's own recordings talking over each other is a small
 * thing that would feel careless here.
 */

interface Props {
  /** The "Keep the recording afterwards" consent, as actually saved. */
  retentionOn: boolean;
  onOpenConsent?: () => void;
}

const formatLength = (seconds?: number): string => {
  if (!seconds || seconds < 1) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const formatWhen = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

export const MyRecordings: React.FC<Props> = ({ retentionOn, onOpenConsent }) => {
  const [recordings, setRecordings] = useState<VoiceRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [openTranscript, setOpenTranscript] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<VoiceRecording | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRecordings(await voiceRecordingStore.list());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!retentionOn) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [retentionOn, refresh]);

  // Stop playback when the card unmounts, so audio never outlives the screen.
  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
    },
    []
  );

  const play = async (rec: VoiceRecording) => {
    setError(null);
    if (playingId === rec.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    const url = await voiceRecordingStore.playbackUrl(rec.storagePath);
    if (!url) {
      setError("That recording could not be opened just now. It is still saved.");
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(url);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => {
      setError("That recording could not be played. It is still saved.");
      setPlayingId(null);
    };
    audioRef.current = audio;
    void audio.play();
    setPlayingId(rec.id);
  };

  const remove = async (rec: VoiceRecording) => {
    setConfirmDelete(null);
    if (playingId === rec.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    }
    const ok = await voiceRecordingStore.remove(rec);
    if (!ok) {
      setError("That recording could not be deleted just now. Please try again.");
      return;
    }
    await refresh();
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-[#EFE8E2] shadow-xs space-y-4">
      <div className="flex items-center gap-2">
        <AudioLines size={15} className="text-[#9A5B33]" />
        <h3 className="text-xs font-black uppercase tracking-wider text-[#7F8C8D]">
          Your Recordings
        </h3>
      </div>

      {!retentionOn ? (
        <div className="space-y-2">
          <p className="text-[11px] text-[#7A726C] leading-relaxed">
            Recordings aren&rsquo;t being kept. When &ldquo;Keep the recording afterwards&rdquo;
            is off, the audio is used for the reflection and then discarded, so there is nothing
            here to play back.
          </p>
          {onOpenConsent && (
            <button
              onClick={onOpenConsent}
              className="text-[11px] font-bold text-[#9A5B33] hover:underline cursor-pointer"
            >
              Change this in Consent Settings
            </button>
          )}
        </div>
      ) : loading ? (
        <p className="text-[11px] text-[#7A726C]" role="status">
          Looking for your recordings&hellip;
        </p>
      ) : recordings.length === 0 ? (
        <p className="text-[11px] text-[#7A726C] leading-relaxed">
          Nothing saved yet. The next time you speak instead of typing, the audio will be kept
          here for you.
        </p>
      ) : (
        <ul className="space-y-2">
          {recordings.map((rec) => {
            const isPlaying = playingId === rec.id;
            const length = formatLength(rec.durationSeconds);
            return (
              <li
                key={rec.id}
                className="rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-[#3C3530]">
                      {formatWhen(rec.recordedAt)}
                      {length && (
                        <span className="font-normal text-[#7A726C]"> &middot; {length}</span>
                      )}
                    </p>
                    {rec.transcript && (
                      <button
                        onClick={() =>
                          setOpenTranscript(openTranscript === rec.id ? null : rec.id)
                        }
                        aria-expanded={openTranscript === rec.id}
                        className="text-[10px] font-semibold text-[#9A5B33] hover:underline cursor-pointer"
                      >
                        {openTranscript === rec.id ? "Hide what was written" : "What was written"}
                      </button>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => play(rec)}
                      aria-label={`${isPlaying ? "Pause" : "Play"} your recording from ${formatWhen(rec.recordedAt)}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#EFE8E2] bg-white text-[#5A5049] transition-colors hover:bg-[#F3F1EA] cursor-pointer"
                    >
                      {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(rec)}
                      aria-label={`Delete your recording from ${formatWhen(rec.recordedAt)}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#EFE8E2] bg-white text-[#8A7A6B] transition-colors hover:border-[#E4C3B4] hover:text-[#A65D52] cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {openTranscript === rec.id && rec.transcript && (
                  <p className="mt-2 border-t border-[#EFE8E2] pt-2 text-[11px] leading-relaxed text-[#5A5049]">
                    {rec.transcript}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p role="alert" className="text-[11px] text-[#A65D52] leading-relaxed">
          {error}
        </p>
      )}

      {retentionOn && recordings.length > 0 && (
        <p className="text-[10px] text-[#7A726C] leading-relaxed">
          Only you can play these. Your counsellor cannot hear them, and deleting one removes the
          audio itself.
        </p>
      )}

      <ConfirmDialog
        isOpen={Boolean(confirmDelete)}
        title="Delete this recording?"
        message="The audio is removed and cannot be recovered. Your written reflection is not affected."
        confirmText="Delete it"
        cancelText="Keep it"
        onConfirm={() => confirmDelete && remove(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};
