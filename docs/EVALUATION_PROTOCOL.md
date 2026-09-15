# Evaluation protocol

**Status:** written before any data was collected. Nothing in here has been run
yet. That is deliberate: a protocol written after seeing results is not a
protocol.

## What is actually claimed today

AURA's 0-100 distress score is **auditable**: every term is shown to the person
it describes, the arithmetic is on screen, and `tests/score-version.test.mjs`
pins it. Auditable is not validated. The weights (28 / 22 / 22 / 17 / 11) were
chosen by the team, not derived from outcome data, and no version of this score
has been tested against any external criterion on any population.

Until the study below is run and reported, the honest sentence is: *"AURA's
score is a transparent, non-clinical trend signal. It has not been validated."*
Anything stronger is a claim the repository cannot support.

## Study 1: concurrent validity against WHO-5

The one study this project can actually run with the sample it has.

### Question

How strongly does AURA's distress score agree with a validated wellbeing
measure taken at the same time?

### Design

- **Instrument:** WHO-5 Well-Being Index, five items, six-point 0-5 scale,
  two-week recall, raw 0-25 scaled x4 to 0-100. Free to use worldwide; WHO took
  copyright in 2024. Implemented in `src/services/instruments.ts` and pinned by
  `tests/instruments.test.mjs`.
- **Pairing:** a WHO-5 administration and an AURA check-in completed in the
  same session. Only pairs, never a WHO-5 matched to a check-in from another
  day.
- **Target n:** 40 participants contributing one pair each. Where a participant
  contributes more than one pair, use their **first** pair only for the primary
  analysis, so the correlation is not inflated by repeated measures from the
  most engaged people.
- **Primary statistic:** Spearman's rho between AURA score and WHO-5 scaled
  score, with a 95% confidence interval. Spearman rather than Pearson because
  neither scale is safely interval and both are bounded.
- **Direction:** the two run opposite ways. High AURA means more distress; high
  WHO-5 means better wellbeing. **A successful result is a negative
  correlation.** State the sign explicitly in any reporting, because a reader
  who assumes the conventional direction will misread it.

### Pre-registered interpretation

Fixed before looking at the data, so the result cannot be re-described after
the fact:

| Observed \|rho\| | What it means | What is then claimed |
| --- | --- | --- |
| >= 0.7 | Strong agreement | "AURA's score tracks a validated wellbeing measure closely (rho, n, CI)." |
| 0.4 - 0.7 | Moderate agreement | "Related but not interchangeable. AURA is a trend signal, not a substitute." |
| < 0.4 | Weak agreement | "AURA's score does not track WHO-5. The weights need revisiting, and the score should not be presented as a wellbeing measure." |

**The result is reported whichever bucket it lands in.** A weak correlation is
a finding about the score, not a reason to bury the study. A project that only
publishes its favourable result has learned nothing and is telling nobody.

### Reporting

One scatter plot: AURA score on x, WHO-5 scaled on y, one point per
participant, with rho, n and CI in the caption. That single figure answers "why
should we trust this number?" better than any amount of prose about
transparency.

### Known limits, stated in advance

- **n is small and not random.** Whoever is using AURA is who is measured.
  Estimates will be imprecise and the sample is not representative of survivors
  generally.
- **Concurrent validity is the weakest useful claim.** It says the two numbers
  move together, not that either predicts anything, and certainly not that AURA
  detects deterioration early. That would need a prospective study this project
  cannot yet run.
- **Neither measure is a criterion.** WHO-5 is a screening instrument, not
  ground truth about anyone.
- **Common-method bias.** Both are self-report, collected minutes apart, by the
  same person, in the same app. Some agreement is guaranteed by that alone.

## Study 2: fairness slices

Run alongside Study 1, on the same pairs.

### The error that matters

**A missed survivor is the costly error.** Someone in real distress whom AURA
scores low is not inconvenienced; they are left alone. A false alarm costs a
counsellor ten minutes. These are not symmetric and the evaluation must not
treat them as though they were.

So the fairness target is **equal false-negative rate across slices**, not equal
accuracy and not equal alert volume.

### Slices

Reported separately, with n for each, and suppressed where n < 5 for the same
reason `communityAggregates.ts` suppresses small regions:

- Language of use (en / hi / mr, and machine-translated interface separately)
- Age group
- Region, where recorded
- Whether the person used voice input or text
- Whether the person has a counsellor assigned

### Definition

Using WHO-5 raw <= 13 as the reference for "worth a closer look", a false
negative is a participant flagged by WHO-5 whom AURA did not place in its
elevated band. Report FNR per slice with a CI.

If FNR differs materially between slices, that is a finding to publish and fix,
not a footnote. The likeliest cause is not the arithmetic: it is that the
questions read differently in a machine-translated interface than in a
hand-written one.

## Study 3: re-administration at day 7 and day 30

Deferred, specified now so it is not designed to fit whatever data appears.

Re-administer WHO-5 at day 7 and day 30 and ask whether change in AURA score
tracks change in WHO-5. This is the claim the product actually makes ("we
notice change"), and it is the one no cross-sectional study can support.
Requires retention this pilot has not yet demonstrated: the current median gap
between check-ins is 3.1 days across 333 intervals, with no participant yet
observed over a 30-day window under the current scoring model.

## Governance notes

- **Consent:** participation in evaluation is separate from consent to use
  AURA. Nobody's data enters a study because they used the app.
- **Withdrawal** removes a participant's pairs from the analysis, not just from
  future collection.
- **Score version:** every check-in records `score_version`. Study 1 uses
  version 2 rows only. Mixing versions would pool two different measurements,
  since version 1 inferred stress from wellbeing and sleep rather than asking.
- **EU AI Act:** if AURA is ever deployed in the EU, a system profiling people
  for distress in a vulnerable population is unlikely to sit in the minimal-risk
  tier. That assessment has not been done and should happen before any EU
  deployment, not after.
