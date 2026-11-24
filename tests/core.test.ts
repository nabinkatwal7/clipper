import test from "node:test";
import assert from "node:assert/strict";
import {
  publicAddress,
  settings,
  validId,
  validateHighlights,
} from "../lib/validation";
import { defaults } from "../lib/types";
import { captions, dimensions, layoutFilter } from "../lib/captions";
test("reject local, mapped, reserved and multicast addresses", () => {
  for (const ip of [
    "127.0.0.1",
    "10.2.3.4",
    "172.16.2.1",
    "192.168.1.1",
    "169.254.169.254",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
    "224.0.0.1",
    "0.0.0.0",
  ])
    assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress("8.8.8.8"), true);
});
test("validate settings and filesystem IDs", () => {
  assert.deepEqual(settings({}), defaults);
  for (const input of [
    { count: 99 },
    { crop: -1 },
    { manualStart: NaN },
    { mode: "shell" },
    { captions: "yes" },
  ])
    assert.throws(() => settings(input));
  for (const id of ["../secret", "a/b", ""]) assert.throws(() => validId(id));
});
test("reject invalid AI selections and remove overlapping moments", () => {
  const h = {
    start: 10,
    end: 50,
    title: "Real moment",
    reason: "Complete story",
    score: 85,
  };
  const results = validateHighlights(
    [
      h,
      { ...h, start: 12, end: 52, score: 92 },
      { ...h, start: -1 },
      { ...h, end: 200 },
      { ...h, score: 101 },
      { ...h, title: "" },
      { ...h, end: 15 },
      { ...h, start: 70, end: 110, score: 71 },
    ],
    120,
    defaults,
  );
  assert.equal(results.length, 2);
  assert.equal(results[0].score, 92);
  assert.equal(results[1].start, 70);
});
test("caption timing is relative to clip and text cannot inject ASS commands", () => {
  const ass = captions(
    [
      {
        start: 10,
        end: 13,
        text: "hello",
        words: [
          { start: 10, end: 11, word: "{bad}\\hello" },
          { start: 11, end: 13, word: "world" },
        ],
      },
    ],
    10,
    12,
    { ...defaults, style: "highlight" },
    1080,
    1920,
  );
  assert.match(ass, /0:00:00.00,0:00:01.00/);
  assert.match(ass, /0:00:01.00,0:00:02.00/);
  assert.doesNotMatch(ass, /\{bad\}/);
  assert.match(ass, /badhello/);
});
test("all aspect ratios use even dimensions and configurable crop", () => {
  for (const ratio of ["9:16", "1:1", "4:5", "16:9"] as const) {
    const [w, h] = dimensions({ ...defaults, ratio });
    assert.equal(w % 2, 0);
    assert.equal(h % 2, 0);
  }
  assert.deepEqual(dimensions(defaults), [720, 1280]);
  assert.match(layoutFilter({ ...defaults, crop: 75 }, 1080, 1920), /\*0.75/);
});
