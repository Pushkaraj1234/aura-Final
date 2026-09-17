import { supabase } from "./supabaseClient";

/**
 * Recordings a person chose to keep.
 *
 * This exists because "Keep the recording afterwards" was a switch that did
 * nothing. The recorder produced a blob URL, which lives in one browser tab
 * and dies with it, so the consent described a retention that never happened
 * whichever way it was set. Everything here is the other half of that switch:
 * with it on, the audio is actually stored and the person can play it back;
 * with it off, nothing is written and anything previously kept is removed.
 *
 * Participant-owned, and staff cannot read it. Counsellors already see
 * transcripts where that is permitted; a recording carries a survivor's voice,
 * who else was in the room and how they sounded, and no consent on the screen
 * covers a counsellor listening to that.
 */

const BUCKET = "voice-recordings";

/** 25 MB, matching the limit set on the bucket itself. */
export const MAX_RECORDING_BYTES = 25 * 1024 * 1024;

export interface VoiceRecording {
  id: string;
  ownerId: string;
  participantId?: string;
  storagePath: string;
  durationSeconds?: number;
  sizeBytes?: number;
  mimeType?: string;
  /** The transcript as it stood when this was kept. Never regenerated. */
  transcript?: string;
  recordedAt: string;
}

const toRecording = (r: any): VoiceRecording => ({
  id: r.id,
  ownerId: r.owner_id,
  participantId: r.participant_id ?? undefined,
  storagePath: r.storage_path,
  durationSeconds: r.duration_seconds ?? undefined,
  sizeBytes: r.size_bytes ?? undefined,
  mimeType: r.mime_type ?? undefined,
  transcript: r.transcript ?? undefined,
  recordedAt: r.recorded_at,
});

async function ownerId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

export const voiceRecordingStore = {
  async list(): Promise<VoiceRecording[]> {
    if (!(await ownerId())) return [];
    const { data, error } = await supabase
      .from("voice_recordings")
      .select("*")
      .order("recorded_at", { ascending: false })
      .limit(50);
    if (error) {
      console.warn("[voiceRecordings] list:", error.message);
      return [];
    }
    return (data ?? []).map(toRecording);
  },

  /**
   * Keeps one recording.
   *
   * Returns null rather than throwing when there is no session or the blob is
   * empty: a failure to keep the audio must never lose the reflection the
   * person just finished, which is the thing they actually came to do.
   */
  async keep(args: {
    blob: Blob;
    participantId?: string;
    durationSeconds?: number;
    transcript?: string;
  }): Promise<VoiceRecording | null> {
    const uid = await ownerId();
    if (!uid || args.blob.size === 0) return null;
    if (args.blob.size > MAX_RECORDING_BYTES) {
      console.warn("[voiceRecordings] recording too large to keep");
      return null;
    }

    const id = `vr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    // The leading folder is the ownership check in the storage policy, so it
    // must always be the uid.
    const storagePath = `${uid}/${id}.webm`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, args.blob, {
        contentType: args.blob.type || "audio/webm",
        upsert: false,
      });
    if (upErr) {
      console.warn("[voiceRecordings] upload:", upErr.message);
      return null;
    }

    const { data, error } = await supabase
      .from("voice_recordings")
      .insert({
        id,
        owner_id: uid,
        participant_id: args.participantId ?? null,
        storage_path: storagePath,
        duration_seconds: args.durationSeconds ? Math.round(args.durationSeconds) : null,
        size_bytes: args.blob.size,
        mime_type: args.blob.type || "audio/webm",
        transcript: args.transcript?.trim() || null,
      })
      .select("*")
      .single();

    if (error || !data) {
      // The row is the index; an object with no row is unreachable, so take it
      // back out rather than leaving it paid for and invisible.
      await supabase.storage.from(BUCKET).remove([storagePath]);
      console.warn("[voiceRecordings] insert:", error?.message);
      return null;
    }
    return toRecording(data);
  },

  /**
   * A short-lived link to one recording.
   *
   * Signed and expiring rather than public: a link that works forever is a
   * link that still works after it has been forwarded or left in a history
   * somebody else reads.
   */
  async playbackUrl(storagePath: string, expiresInSeconds = 600): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds);
    if (error || !data?.signedUrl) {
      console.warn("[voiceRecordings] signed url:", error?.message);
      return null;
    }
    return data.signedUrl;
  },

  async remove(recording: VoiceRecording): Promise<boolean> {
    await supabase.storage.from(BUCKET).remove([recording.storagePath]);
    const { error } = await supabase.from("voice_recordings").delete().eq("id", recording.id);
    if (error) {
      console.warn("[voiceRecordings] delete:", error.message);
      return false;
    }
    return true;
  },

  /**
   * Withdrawing the consent removes what it was keeping.
   *
   * A switch that stops future retention but leaves everything already stored
   * is not a withdrawal, it is a pause, and the consent screen does not
   * describe a pause.
   */
  async removeAll(): Promise<number> {
    const all = await voiceRecordingStore.list();
    if (all.length === 0) return 0;
    await supabase.storage.from(BUCKET).remove(all.map((r) => r.storagePath));
    const { error } = await supabase
      .from("voice_recordings")
      .delete()
      .in("id", all.map((r) => r.id));
    if (error) {
      console.warn("[voiceRecordings] removeAll:", error.message);
      return 0;
    }
    return all.length;
  },
};
