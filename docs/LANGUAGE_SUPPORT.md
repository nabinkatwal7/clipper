# Language support

Clipper Studio treats these as separate concerns: the language of the **interface**, the **audio**, the **transcript**, the **captions** and any **translation**. They do not have to match.

## What exists today

| Capability | Status |
| --- | --- |
| Unicode text throughout (import, edit, display, burn into video) | Implemented |
| Importing SRT/VTT subtitles in any script | Implemented |
| Translating timestamped caption lines with an installed Ollama text model | Implemented; quality depends on the model |
| Mixed-language text (for example Nepali–English) | Works as text; no special code-switching logic |
| Interface languages | English, Nepali and Hindi on the landing page and core studio controls; advanced screens use English fallbacks |
| Speech recognition | Local whisper.cpp with an installed multilingual GGML model |
| Transliteration, bilingual caption tracks, per-language dictionaries | Partial or planned; see [FEATURE_MATRIX.md](../FEATURE_MATRIX.md) |

## Transcripts

Transcripts come from:

1. subtitles published with a video (imported automatically), or
2. a timed subtitle file you import in Transcript explorer, or
3. local whisper.cpp speech recognition when a runtime and model are configured.

Without a transcript, AI highlights and captions are skipped; the studio makes fixed-length or manual clips instead and labels them so. Nothing is fabricated for languages the studio cannot transcribe.

## Translation quality

Translation uses whatever model you select in Ollama. Models differ widely in language coverage, handling of slang and names, and consistency. Always review machine translation before publishing. Timestamps and original text are preserved; the original transcript is not overwritten.

## Rendering non-Latin scripts

Captions are burned in with FFmpeg's `libass`. Browser previews are not proof of correct export: complex scripts (Devanagari, Arabic, Bengali, Thai and others) need a font that contains the glyphs and a libass build with shaping support. Export a short test clip in your script before a long job. Right-to-left layout and per-language fonts are known gaps.

## Speech recognition quality

Recognition runs in bounded audio sections and saves segment-level timecodes. The CPU model can make mistakes with accents, background noise, code-switching and names. Review the transcript before publishing. Automatic recognition does not supply word-level caption timing.
