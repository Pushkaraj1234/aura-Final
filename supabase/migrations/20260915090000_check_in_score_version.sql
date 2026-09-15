-- Mark which scoring model produced a check-in.
--
-- Until now the 22-point stress term was not asked. It was inferred:
--
--   stress = clamp(1..5, round(6 - (wellbeing + sleep) / 2))
--
-- so it restated the two answers either side of it and those two drove 61 of
-- the 100 points between them. Step 7 now asks the question directly, which
-- means stress finally carries information of its own.
--
-- The formula in riskEngine.ts is deliberately unchanged, and so is the stored
-- meaning of the column: check_ins.stress is still 1 (calm) to 5 (very
-- stressed). That matters more than it looks. trajectoryEngine recomputes
-- every historical check-in with the current formula rather than reading back
-- calculated_score, so flipping what a stored 5 means would have silently
-- rewritten the trend of all 360 rows already recorded.
--
-- What does change is the nature of the input. Before this, a person under
-- real pressure who slept adequately could not score as stressed, because
-- nothing asked them. After it, they can. Same formula, better evidence, and
-- a step in the series that is not the person changing.
--
-- Hence this column. Version 1 is an inferred stress term; version 2 is a
-- measured one. A trend crossing the boundary should be drawn with a marker
-- rather than a smooth line, so a counsellor seeing a jump can tell whether
-- the person moved or the ruler did.

alter table public.check_ins
  add column if not exists score_version smallint not null default 1;

comment on column public.check_ins.score_version is
  '1 = stress inferred from wellbeing and sleep. 2 = stress asked directly (step 7). The weights are identical across both; only the quality of the stress input differs. Do not compare a v1 score with a v2 score as though the scale were continuous.';

-- Everything recorded before this migration was answered under the old
-- questionnaire, so the default of 1 is already correct for them and no
-- backfill is needed. Stated rather than assumed, because a later reader will
-- wonder whether the backfill was forgotten.
