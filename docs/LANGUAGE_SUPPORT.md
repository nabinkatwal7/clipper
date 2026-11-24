# Language support

Clipper Studio treats these as separate concerns: the language of the **interface**, the **audio**, the **transcript**, the **captions** and any **translation**. They do not have to match.

## What exists today

| Capability | Status |
| --- | --- |
| Unicode text throughout (import, edit, display, burn into video) | Implemented |
| Importing SRT/VTT subtitles in any script | Implemented |
| Translating timestamped caption lines with an installed Ollama text model | Implemented; quality depends on the model |
| Mixed-language text (for example Nepali–English) | Works as text; no special code-switching logic |
| Interface languages | English, Nepali and Hindi on the public home page; the studio is English |
| Speech recognition | **Not included** |
| Transliteration, bilingual caption tracks, per-language dictionaries | Partial or planned; see [FEATURE_MATRIX.md](../FEATURE_MATRIX.md) |

## Transcripts

There is no built-in speech-to-text. Transcripts come from:

1. subtitles published with a video (imported automatically), or
2. a timed subtitle file you import in Transcript explorer.

Without a transcript, AI highlights and captions are skipped; the studio makes fixed-length or manual clips instead and labels them so. Nothing is fabricated for languages the studio cannot transcribe.

## Translation quality

Translation uses whatever model you select in Ollama. Models differ widely in language coverage, handling of slang and names, and consistency. Always review machine translation before publishing. Timestamps and original text are preserved; the original transcript is not overwritten.

## Rendering non-Latin scripts

Captions are burned in with FFmpeg's `libass`. Browser previews are not proof of correct export: complex scripts (Devanagari, Arabic, Bengali, Thai and others) need a font that contains the glyphs and a libass build with shaping support. Export a short test clip in your script before a long job. Right-to-left layout and per-language fonts are known gaps.

## Adding speech recognition later

A future path is an Ollama model with verified audio-transcription support, gated on a functional capability test rather than on text-language claims. Contributions should follow that rule: never infer speech-recognition ability from text-language ability.
