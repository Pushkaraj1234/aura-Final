# Concordance policy

**Status:** binding on the code. Enforced by `tests/concordance-policy.test.mjs`.

## What concordance is

`assessConcordance()` compares what a person said about themselves against
everything else in the same check-in: hours slept, somatic answers, how the form
was moved through. It reports whether those agree, and it fires on disagreement
even when the distress score is low. That is the whole reason it exists. Someone
who answers "I'm fine" and then says they slept three hours is the case a
score-only system never surfaces.

## Why it needs a policy and not just a docstring

Pointed the wrong way, this is a lie detector aimed at torture survivors.

The failure is not hypothetical and it is not mainly technical. A worker who
reads `diverging` as "this person is not telling me the truth" will carry that
into the room. Most people whose answers diverge are not concealing anything.
They are numb, or frightened of what happens if they say it plainly, or
describing distress through their body because that is how distress is
described where they come from. A tool that quietly reframes those people as
unreliable narrators of their own lives does more harm than the missed case it
was built to catch.

So the constraints below are not implementation details to be traded away for a
cleaner component tree later. They are the conditions under which this feature
is allowed to exist at all.

## The rules

### 1. The self-report is never overwritten

`assessConcordance` takes a check-in and returns a separate object. It does not
mutate its input, and nothing downstream rewrites `wellbeing`, `stress`,
`sleep`, `safety` or `connection` on the basis of a concordance result. The
number a person gave is the number that is stored, shown and scored, whatever
the rest of the form suggests.

A divergence changes *who looks*, never *what was said*.

### 2. It is never shown to the participant

No participant-facing screen may import `concordanceEngine`, render a
`ConcordanceResult`, or paraphrase one. A person must never open this app and
find it telling them their answers look inconsistent. There is no wording that
makes that safe.

Participant-facing, for the purposes of this rule, means anything reachable
while signed in as a participant, and the guardian form, which is filled in by a
family member about someone else.

### 3. It is a prompt to look again, not a verdict

`needsSecondLook` asks a worker to pay attention. It is not a risk rating, not
an accuracy score, and not evidence. It carries no weight in the distress score
(`riskEngine` never reads it) and it must not be used to rank, filter or triage
people on its own.

### 4. It stays rule-based and readable

Every signal is a stated rule a worker can read, disagree with and overrule. If
this is ever replaced by a learned model, the model must still emit the
individual signals in plain language, because a worker who cannot see why the
flag fired cannot responsibly ignore it.

## What the test enforces

`tests/concordance-policy.test.mjs` fails the build if:

- `assessConcordance` mutates the check-in it is given
- a participant-facing source file imports the concordance engine
- the result object grows a field that reads as a verdict about the person
  (`credibility`, `honesty`, `truthfulness`, `deception`, `reliability`)
- the distress score changes when concordance is present

Rules 3 and 4 are partly matters of judgement and wording, so the test pins what
can be pinned mechanically and this document carries the rest.

## Before this touches a real person

Two things that code cannot check, and that should be true first:

1. **Workers are briefed.** Anyone who sees a divergence flag should have been
   told, in training and not only in a tooltip, what the list of ordinary
   reasons for divergence is.
2. **The wording is reviewed by someone who has sat with survivors**, not only
   by the people who wrote it. The summary strings are the part a worker
   actually reads.

Neither has happened yet. Recorded here so the gap is visible rather than
assumed closed.
