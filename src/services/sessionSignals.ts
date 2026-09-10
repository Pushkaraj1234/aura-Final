/**
 * How a check-in was answered, rather than what was answered.
 *
 * Everything here comes from events the browser already fires — page
 * visibility, step navigation, keystrokes into a textarea the person is
 * already typing in. There is no permission prompt, nothing is recorded that
 * a person did not do inside this form, and it works on the phones this app
 * actually runs on. That last point is why this is the passive signal AURA
 * collects and mouse or keystroke-timing dynamics are not: `mousemove` never
 * fires on a touch screen, and Android soft keyboards report keyCode 229
 * during IME composition, so per-key timing is unmeasurable for exactly the
 * people typing in their own script.
 *
 * The rule that makes this safe to collect at all: none of it may move the
 * distress score. It feeds concordance — whether a support worker should
 * look again — and nothing else. A person who hesitates is not thereby more
 * distressed, and a number derived from hesitation would be a number nobody
 * could check.
 */

export interface SessionSignals {
  /** Times the app lost focus during the check-in. */
  awayCount?: number;
  /** Longest single absence, in seconds. */
  longestAwaySeconds?: number;
  /** Times they went back to a question already answered. */
  backNavigations?: number;
  /** Answers changed after first being set. */
  answerRevisions?: number;
  /**
   * Longest uninterrupted time on a single question, in seconds. Time spent
   * away from the app is subtracted, so this is hesitation rather than a
   * phone put down to answer the door.
   */
  longestQuestionSeconds?: number;
  /** Median seconds per question — steadier than a mean on a phone. */
  medianQuestionSeconds?: number;
  /** Wrote something in the reflection, deleted it, and submitted nothing. */
  reflectionAbandoned?: boolean;
  /** Most characters the reflection ever held before being cut back. */
  reflectionPeakChars?: number;
}

/** Below this, a "pause" is just reading the question. */
const MIN_MEANINGFUL_PAUSE_SECONDS = 3;

/** A tab-away shorter than this is a notification glance, not leaving. */
const MIN_MEANINGFUL_AWAY_MS = 2000;

/**
 * Collects the signals above over the life of one check-in.
 *
 * Nothing in here throws. It runs on a screen someone opened while
 * struggling, and a telemetry bug must never be the thing that stops them
 * finishing — every public method is wrapped, and a collector that failed
 * simply reports less.
 */
export class SessionSignalCollector {
  private startedAt = 0;
  private running = false;

  private awayCount = 0;
  private longestAwayMs = 0;
  private awaySince: number | null = null;
  /** Time spent away during the current question, excluded from its dwell. */
  private awayDuringStepMs = 0;

  private currentStep: number | null = null;
  private stepEnteredAt = 0;
  private furthestStep = 0;
  private backNavigations = 0;
  /** Uninterrupted seconds per question, summed across revisits. */
  private stepSeconds = new Map<number, number>();

  /** First value seen per answer, to notice a later change. */
  private firstAnswers = new Map<string, string>();
  private revisions = new Set<string>();

  private reflectionPeakChars = 0;
  private reflectionFinalChars = 0;

  private onVisibility: (() => void) | null = null;

  start(): void {
    try {
      if (this.running) return;
      this.running = true;
      this.startedAt = Date.now();

      if (typeof document === "undefined") return;

      this.onVisibility = () => {
        try {
          if (document.visibilityState === "hidden") {
            this.awaySince = Date.now();
            return;
          }
          if (this.awaySince === null) return;
          const away = Date.now() - this.awaySince;
          this.awaySince = null;
          if (away < MIN_MEANINGFUL_AWAY_MS) return;
          this.awayCount++;
          this.awayDuringStepMs += away;
          if (away > this.longestAwayMs) this.longestAwayMs = away;
        } catch {
          // A telemetry failure must not surface to the person answering.
        }
      };
      document.addEventListener("visibilitychange", this.onVisibility);
    } catch {
      // Collector stays inert; the check-in is unaffected.
    }
  }

  /** Call on every step change, including the first. */
  enterStep(step: number): void {
    try {
      if (!this.running) return;
      const now = Date.now();

      if (this.currentStep !== null) {
        // Subtract any time the app was in the background, so a phone put
        // down does not read as someone agonising over the question.
        const dwell = Math.max(0, now - this.stepEnteredAt - this.awayDuringStepMs);
        this.stepSeconds.set(
          this.currentStep,
          (this.stepSeconds.get(this.currentStep) || 0) + dwell / 1000
        );
      }

      if (this.currentStep !== null && step < this.currentStep && step >= 1) {
        this.backNavigations++;
      }

      this.currentStep = step;
      this.stepEnteredAt = now;
      this.awayDuringStepMs = 0;
      if (step > this.furthestStep) this.furthestStep = step;
    } catch {
      // ignore
    }
  }

  /**
   * Records an answer. The first value for a key is the baseline; any later
   * different value counts that answer as revised, however many times it
   * changes after that.
   */
  recordAnswer(key: string, value: unknown): void {
    try {
      if (!this.running) return;
      const serialised = JSON.stringify(value ?? null);
      const first = this.firstAnswers.get(key);
      if (first === undefined) {
        this.firstAnswers.set(key, serialised);
        return;
      }
      if (first !== serialised) this.revisions.add(key);
    } catch {
      // ignore
    }
  }

  /** Records the reflection's current length on every change. */
  recordReflection(text: string): void {
    try {
      if (!this.running) return;
      const len = (text || "").trim().length;
      this.reflectionFinalChars = len;
      if (len > this.reflectionPeakChars) this.reflectionPeakChars = len;
    } catch {
      // ignore
    }
  }

  /** Freezes and returns what was collected. Safe to call more than once. */
  finish(): SessionSignals {
    try {
      // Close the question currently open, so its time is not lost.
      this.enterStep(this.currentStep ?? 0);

      const durations = Array.from(this.stepSeconds.values()).filter(
        (s) => s >= MIN_MEANINGFUL_PAUSE_SECONDS
      );
      durations.sort((a, b) => a - b);

      const median = durations.length
        ? durations.length % 2
          ? durations[(durations.length - 1) / 2]
          : (durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2
        : undefined;

      const longest = durations.length ? durations[durations.length - 1] : undefined;

      return {
        awayCount: this.awayCount || undefined,
        longestAwaySeconds: this.longestAwayMs
          ? Math.round(this.longestAwayMs / 1000)
          : undefined,
        backNavigations: this.backNavigations || undefined,
        answerRevisions: this.revisions.size || undefined,
        longestQuestionSeconds: longest !== undefined ? Math.round(longest) : undefined,
        medianQuestionSeconds: median !== undefined ? Math.round(median) : undefined,
        // Wrote something real, then took it all back.
        reflectionAbandoned:
          this.reflectionPeakChars >= 20 && this.reflectionFinalChars === 0 ? true : undefined,
        reflectionPeakChars: this.reflectionPeakChars || undefined,
      };
    } catch {
      return {};
    }
  }

  /** Detaches listeners. Must be called when the check-in unmounts. */
  dispose(): void {
    try {
      this.running = false;
      if (this.onVisibility && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", this.onVisibility);
      }
      this.onVisibility = null;
    } catch {
      // ignore
    }
  }
}
