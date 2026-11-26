import { strict as assert } from "node:assert";
import { test } from "node:test";
import { speechSegments } from "../lib/speech";

test("speech recognition clips segment timestamps to the source window", () => {
  const rows = speechSegments(
    {
      transcription: [
        { offsets: { from: 250, to: 1750 }, text: " नमस्ते " },
        { offsets: { from: 1800, to: 2200 }, text: "later speech" },
        { offsets: { from: 0, to: 1000 }, text: "[BLANK_AUDIO]" },
        { offsets: { from: "0", to: 1000 }, text: "Invalid timestamp" },
      ],
    },
    600,
    602,
  );
  assert.deepEqual(rows, [
    { start: 600.25, end: 601.75, text: "नमस्ते", words: [] },
    { start: 601.8, end: 602, text: "later speech", words: [] },
  ]);
  assert.throws(
    () => speechSegments({ transcription: null }, 0, 10),
    /invalid transcript/,
  );
});
