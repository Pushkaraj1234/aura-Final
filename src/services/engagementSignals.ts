import { CheckIn, Message } from "../types/index.js";

/**
 * Passive engagement signals — what someone's pattern of use says when they
 * are not saying anything.
 *
 * Everything the rest of AURA reads requires the person to show up and answer
 * questions. That is exactly the wrong assumption for someone under threat:
 * the most alarming state is not a bad answer, it is no answer. This reads
 * the shape of their engagement instead — when they check in, whether they
 * still reach out, how long they take to reply — and it keeps working when
 * they have stopped participating altogether.
 *
 * WHAT THIS DELIBERATELY DOES NOT USE
 *
 * Call logs are not available to a web application at all; the in-app message
 * thread is the honest analogue and is what this reads. Location history is
 * not collected, and that is a safety decision rather than a technical one: a
 * record of where an atrocity survivor has been is precisely the record that
 * must not exist if a device or account is ever compromised.
 *
 * Nothing here is newly collected. Every signal is derived from check-ins and
 * messages the app already stores.
 */

export type EngagementSeverity = "info" | "notable" | "serious";

export interface EngagementSignal {
  key: string;
  label: string;
  /** The specific fact, phrased for a counsellor to read and argue with. */
  reading: string;
  severity: EngagementSeverity;
  /** Why this reading matters, shown small. */
  note?: string;
}

export interface EngagementAssessment {
  signals: EngagementSignal[];
  daysSinceLastCheckIn: number | null;
  daysSinceAnyContact: number | null;
  /** Their own established rhythm, in days. Null until there is enough history. */
  baselineCadenceDays: number | null;
  assessedAt: string;
}

const DAY_MS = 86_400_000;

/** Below this many check-ins there is no rhythm to depart from. */
const MIN_HISTORY_FOR_CADENCE = 4;

const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const timesOf = (items: { timestamp?: string; createdAt?: string }[]): number[] =>
  items
    .map((i) => new Date(i.timestamp || i.createdAt || "").getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);

const gapsBetween = (times: number[]): number[] => {
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) gaps.push((times[i] - times[i - 1]) / DAY_MS);
  return gaps;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function assessEngagement(input: {
  checkIns: CheckIn[];
  messages?: Message[];
  /** Injectable for tests; defaults to now. */
  now?: number;
}): EngagementAssessment {
  const now = input.now ?? Date.now();
  const checkInTimes = timesOf(input.checkIns || []);
  const messages = input.messages || [];
  const signals: EngagementSignal[] = [];

  const add = (
    key: string,
    label: string,
    reading: string,
    severity: EngagementSeverity,
    note?: string
  ) => signals.push({ key, label, reading, severity, note });

  const lastCheckIn = checkInTimes.length ? checkInTimes[checkInTimes.length - 1] : null;
  const daysSinceLastCheckIn =
    lastCheckIn === null ? null : Math.floor((now - lastCheckIn) / DAY_MS);

  const messageTimes = timesOf(messages);
  const lastAnything = Math.max(lastCheckIn ?? 0, messageTimes[messageTimes.length - 1] ?? 0);
  const daysSinceAnyContact = lastAnything ? Math.floor((now - lastAnything) / DAY_MS) : null;

  // --- Silence, measured against their own rhythm ------------------------
  const gaps = gapsBetween(checkInTimes);
  const baseline =
    checkInTimes.length >= MIN_HISTORY_FOR_CADENCE ? median(gaps) : null;

  if (daysSinceLastCheckIn !== null && baseline !== null && baseline > 0) {
    const ratio = daysSinceLastCheckIn / baseline;
    if (ratio >= 3 && daysSinceLastCheckIn >= 7) {
      add("silence", "Gone quiet",
        `${plural(daysSinceLastCheckIn, "day")} since the last check-in, against a usual ${baseline.toFixed(0)}-day rhythm`,
        "serious",
        "Measured against this person's own pattern, not a fixed schedule — someone who was always sporadic is not withdrawing.");
    } else if (ratio >= 2 && daysSinceLastCheckIn >= 4) {
      add("silence", "Slower than usual",
        `${plural(daysSinceLastCheckIn, "day")} since the last check-in, usually every ${baseline.toFixed(0)}`,
        "notable");
    }
  }

  // --- A rhythm that is stretching out, not yet broken -------------------
  if (gaps.length >= 5) {
    const recent = median(gaps.slice(-3));
    const earlier = median(gaps.slice(0, -3));
    if (recent !== null && earlier !== null && earlier > 0 && recent / earlier >= 2) {
      add("cadenceDecay", "Checking in less often",
        `recent gaps around ${recent.toFixed(0)} days, previously ${earlier.toFixed(0)}`,
        "notable",
        "A rhythm stretching out often precedes it stopping.");
    }
  }

  // --- Use shifting into the night ---------------------------------------
  // Not a sleep measurement, and not treated as one — it is a reason to ask
  // about sleep, which the questionnaire can then answer properly.
  if (checkInTimes.length >= 6) {
    const isNight = (t: number) => {
      const h = new Date(t).getHours();
      return h >= 0 && h < 5;
    };
    const recent = checkInTimes.slice(-4);
    const earlier = checkInTimes.slice(0, -4);
    const recentNight = recent.filter(isNight).length;
    const earlierNightRate = earlier.length
      ? earlier.filter(isNight).length / earlier.length
      : 0;
    if (recentNight >= 3 && earlierNightRate < 0.34) {
      add("nightShift", "Now checking in at night",
        `${recentNight} of the last ${recent.length} between midnight and 5am`,
        "notable",
        "Worth asking about sleep rather than concluding anything from it.");
    }
  }

  // --- Reaching out, and stopping ----------------------------------------
  const fromParticipant = messages
    .filter((m) => m.senderRole === "participant")
    .map((m) => new Date(m.createdAt).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);

  if (fromParticipant.length >= 3) {
    const lastOutreach = fromParticipant[fromParticipant.length - 1];
    const daysSince = Math.floor((now - lastOutreach) / DAY_MS);
    const priorGaps = gapsBetween(fromParticipant);
    const usual = median(priorGaps);
    if (usual !== null && usual > 0 && daysSince / usual >= 3 && daysSince >= 10) {
      add("outreachStopped", "Stopped messaging",
        `${plural(daysSince, "day")} since they last wrote, having written every ${usual.toFixed(0)} days`,
        "serious",
        "Someone who used to make contact and no longer does has changed something.");
    }
  }

  // --- A counsellor's message left unanswered ----------------------------
  const lastWorkerMessage = messages
    .filter((m) => m.senderRole === "support_worker")
    .map((m) => new Date(m.createdAt).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)
    .pop();

  if (lastWorkerMessage) {
    const repliedAfter = fromParticipant.some((t) => t > lastWorkerMessage);
    const daysWaiting = Math.floor((now - lastWorkerMessage) / DAY_MS);
    if (!repliedAfter && daysWaiting >= 5) {
      add("unanswered", "Outreach unanswered",
        `no reply for ${plural(daysWaiting, "day")}`,
        daysWaiting >= 10 ? "serious" : "notable",
        "Says nothing about why — only that the thread is one-directional.");
    }
  }

  // --- Replies taking longer than they used to ---------------------------
  const latencies: number[] = [];
  const ordered = [...messages]
    .map((m) => ({ ...m, t: new Date(m.createdAt).getTime() }))
    .filter((m) => Number.isFinite(m.t))
    .sort((a, b) => a.t - b.t);

  for (let i = 0; i < ordered.length; i++) {
    if (ordered[i].senderRole !== "support_worker") continue;
    const reply = ordered.slice(i + 1).find((m) => m.senderRole === "participant");
    if (reply) latencies.push((reply.t - ordered[i].t) / DAY_MS);
  }

  if (latencies.length >= 4) {
    const recent = median(latencies.slice(-2));
    const earlier = median(latencies.slice(0, -2));
    if (recent !== null && earlier !== null && earlier > 0 && recent / earlier >= 3 && recent >= 2) {
      add("replyLatency", "Taking longer to reply",
        `around ${recent.toFixed(1)} days recently, previously ${earlier.toFixed(1)}`,
        "notable");
    }
  }

  return {
    signals,
    daysSinceLastCheckIn,
    daysSinceAnyContact,
    baselineCadenceDays: baseline,
    assessedAt: new Date(now).toISOString(),
  };
}
