import test from "node:test";
import assert from "node:assert/strict";
import { captions } from "../lib/captions";
import { defaults } from "../lib/types";
import { settings } from "../lib/validation";
import { parseVtt } from "../lib/source-subtitles";

test("subtitle import preserves source times and removes rolling duplicated text", () => {
  const rows = parseVtt(
    "WEBVTT\n\n00:00:00.500 --> 00:00:02.000\nHello\n\n00:00:02.000 --> 00:00:04.000\nHello\n<00:00:02.050>world!\n",
  );
  assert.deepEqual(
    rows.map(({ start, end, text }) => [start, end, text]),
    [
      [0.5, 2, "Hello"],
      [2, 4, "world!"],
    ],
  );
});
test("the title overlay stays relative to a trim and cannot inject ASS tags", () => {
  const ass = captions(
    [],
    20,
    23,
    {
      ...defaults,
      captions: false,
      overlayText: "{test}\\title",
      overlayY: 20,
    },
    720,
    1280,
  );
  assert.match(ass, /Dialogue: 1,0:00:00.00,0:00:03.00/);
  assert.ok(ass.includes("\\pos(360,256)"));
  assert.ok(ass.includes("testtitle"));
});
test("render settings reject out-of-range transforms and malformed caption colors", () => {
  for (const input of [
    { opacity: 2 },
    { rotation: 999 },
    { scale: 0 },
    { captionColor: "silver" },
    { overlayText: "x".repeat(101) },
  ])
    assert.throws(() => settings(input));
});
