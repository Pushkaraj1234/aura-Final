# Future roadmap: audio-based violence/distress detection

**Status:** Not built. This is a scoping note only — no code in this repo depends on it.

## What was evaluated

Two inputs were checked against AURA's existing voice check-in feature (which already
extracts acoustic features — pitch, pace, pauses, loudness — from a participant's
recording and reasons about them via the Gemini API):

- `cnn1.ipynb` — a notebook that trains a small Keras CNN to classify audio clips as
  "violence" vs. "not violence" from mel-spectrogram images.
- The dataset it depends on (`VSD.xlsx` + a folder of `.wav` recordings, referred to
  here as VSD — "Violence Sound Detection"): **real and usable**. `VSD.xlsx` has 341
  labeled violence-segment timestamps (start/end/duration) across roughly 128 source
  recordings. The audio folder holds the actual clips, mostly tens of MB each; four
  files (the `noviolence_0X.wav` masters) are 650–875MB.

## Why it isn't integrated today

1. **No Python/ML runtime in this app.** AURA's entire backend is Node/Express/
   TypeScript; the only model inference anywhere is a request to Google's Gemini API.
   The notebook's pipeline (librosa spectrograms → Keras CNN) needs a Python/
   TensorFlow environment that doesn't exist here, and adding one is a new subsystem,
   not a config change.
2. **Deployment gap even after training.** A trained Keras model still needs a way to
   run from this app — either a converted TensorFlow.js model loaded client-side, or
   a separate Python inference service the Express server calls out to. Neither
   exists, and both are non-trivial additions (model conversion, a new service
   boundary, latency/hosting considerations).
3. **Small dataset, uncertain payoff.** ~128 source recordings is a small corpus for
   a CNN from scratch; without transfer learning and careful validation, there's a
   real chance the trained model wouldn't generalize past this specific dataset's
   recording conditions.
4. **Transfer limits.** The four largest source files (650–875MB) exceed what could
   be moved into a disposable cloud build environment in one piece during this
   session — a real build would need to either work around that (chunking, or
   training on a machine with direct access to the files) or exclude those four.

## If this gets picked up later

A realistic path, roughly in order:
- Stand up a small Python service (FastAPI or similar) alongside the existing Express
  server, or a scheduled offline training job — kept fully separate from the
  Node/TypeScript codebase.
- Use transfer learning (e.g. a pretrained audio embedding model — YAMNet, VGGish —
  fine-tuned on the VSD segments) rather than training a CNN from scratch, given the
  dataset size.
- Export to ONNX or TensorFlow.js for inference, and decide client-side (private,
  no audio leaves the device) vs. server-side (simpler to update, but requires
  streaming/uploading raw audio, which AURA's current design avoids).
- Treat its output as one more signal into the existing Gemini-based comprehensive
  analysis (`server/aiService.ts`), not a standalone verdict — consistent with the
  app's "AI-assisted, human-decided" principle.
- Re-run the same privacy/consent review the rest of AURA's voice feature already
  went through, since this would mean analyzing raw audio content more deeply than
  today's acoustic-feature extraction does.

## Source files

- `VSD.xlsx` — uploaded to this conversation; not committed to this repo.
- Audio folder — connected from the user's device at `G:\audios_VSD\audios_VSD`
  during this session; not copied into this repo (multi-gigabyte, and several files
  exceed typical repo size limits regardless).
