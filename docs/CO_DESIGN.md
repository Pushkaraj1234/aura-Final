# Co-design record

## The honest position first

**No survivor has been consulted in the design of AURA.**

Not one interview, not one workshop, not one review session. Every decision
below was made by the people building it, reasoning about survivors rather than
with them. The data in the running system is synthetic and seeded.

That is the single largest gap in this project, and it is larger than any of the
technical gaps. A trauma product designed without the people it is for is a
guess, however carefully reasoned. This file exists so that gap is stated rather
than left for someone to discover.

What follows is therefore not a co-design record. It is the **pre-co-design
baseline**: the decisions made on survivors' behalf, with the reasoning behind
each, written down so that when someone does sit with a survivor the
conversation can start from "here is what we assumed and why" rather than from a
blank page. Several of these assumptions are probably wrong. Finding out which
is the point.

## Decisions made on survivors' behalf

Each of these is traceable to code in this repository. The reasoning is recorded
at the decision site, not only here.

| Decision | Why it was made | Where it lives | Assumption that needs testing |
| --- | --- | --- | --- |
| Asking for support does **not** raise the distress score | It used to add 10 points. That meant an identical person who said "I'm fine, I don't need anyone" scored lower and could fall below the follow-up threshold. The model was rewarding denial with a quieter alert, on exactly the people least likely to ask. | `riskEngine.ts` | That people read the request button as safe rather than as something that will be used to rate them. |
| The score's full arithmetic is shown to the person it describes | A number about someone that they cannot interrogate is a number they can only accept or reject. | `ScoreFormulaCard.tsx` | That seeing the derivation reassures rather than makes someone feel measured. |
| The AI may move the score by at most ±15, and only in proportion to how much the person actually wrote | An unbounded model adjustment would overwrite a number the person has a derivation for. A sentence moving the score by a sixth of the scale is not a reading of that sentence. | `recommendationEngine.ts` | That the cap is set at the right place. It was chosen, not fitted. |
| Concordance is never shown to the participant | Pointed at a survivor, a divergence flag is a lie detector. Most divergence is numbness, fear, or distress voiced through the body. | `docs/CONCORDANCE_POLICY.md`, enforced by test | That workers read it as "look again" and not as "they are lying". Untested, and the likeliest place for real harm. |
| A participant may change counsellor without giving a reason | Requiring a reason means explaining, to the institution, why the person it assigned you did not work. | `ChooseCounsellor.tsx` | That people know the option exists. |
| The first-aid kit is private by default, and sharing is opt-in | It is a list of what helps a specific person. Defaulting it visible makes it a record about them rather than a resource for them. | `FirstAidKitEditor.tsx` | That the default is the one people would have chosen. |
| Crisis keywords include Hindi and Marathi terms, not only English | A safety net that only catches English is not a safety net for this population. | `aiService.ts` | That the specific terms are the ones people actually use. Chosen by the team, not by speakers in distress. |
| A missing score is never stored as 50 | It used to be. A number nobody's answers produced, sitting mid-scale, reading as "moderate distress" for someone who might be calm or in crisis. | `supabaseService.ts` | None. This one is just a bug fix. |
| Exercises never promise the score will go down | Telling a distressed person that breathing will lower their number sets them up to feel they failed at breathing. | `actionGuides.ts`, `sectionExercises.ts` | That the framing lands as intended in translation. |
| Regions with fewer than five participants are not reported at all | A mean distress score published next to a district of three people is a sentence about those three people. | `communityAggregates.ts` | That five is the right threshold for these settings. It is a convention, not a derivation. |

## What co-design would have to involve

Written now so it cannot later be quietly redefined as "we showed it to two
people".

1. **Who.** Survivors who have used a support service, not proxies for them.
   Caseworkers are not substitutes; they are a second, separate group.
2. **Paid.** Time and expertise, at a real rate. Unpaid consultation of
   traumatised people by a project that wants their credibility is extraction.
3. **Able to change the product.** If the only outcomes available are wording
   tweaks, it is user testing, not co-design. At least one of the decisions in
   the table above should be genuinely on the table.
4. **Trauma-informed logistics.** Opt out at any point without explaining,
   no requirement to recount what happened, support available afterwards, and
   the session not conditional on continuing to use the app.
5. **Recorded here.** Every session adds a row to the table below, including
   the ones where nothing changed, since "we heard this and did not act on it"
   is the part most projects delete.

## What changed because of co-design

| Date | Who | What they said | What changed | What did not change, and why |
| --- | --- | --- | --- | --- |
| — | — | — | — | — |

**This table is empty and should stay empty until it is not.** Filling it with
anything other than real sessions would make this document worse than not
having one, because it would convert an honest gap into a false claim.
