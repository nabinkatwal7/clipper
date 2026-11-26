import test from "node:test";
import assert from "node:assert/strict";
import { validateProposals } from "../lib/director";
import { compileWorkflow, type Workflow } from "../lib/workflow";
import { analysisWindows, passesRules } from "../lib/discovery";
import { defaults, type Highlight, type Segment } from "../lib/types";
import { curve, sampleCurve, validateComposition } from "../lib/composition";
import { applyChromaKey, layerPose } from "../lib/preview-layers";
import { dragTrack } from "../lib/timeline-gestures";
import { previewKey } from "../lib/preview-cache";
import { proxyPath } from "../lib/media-proxy";
import {
  animationPresets,
  applyAnimationPreset,
} from "../lib/animation-presets";
test("director keeps only bounded, explained edit proposals", () => {
  const proposals = [
    { kind: "range", start: 1, end: 2, why: "Lead in" },
    { kind: "range", start: -1, end: 4, why: "Outside" },
    { kind: "command", why: "Other" },
    { kind: "zoom", scale: 3, why: "Too large" },
  ];
  assert.deepEqual(validateProposals(proposals, 0, 5), [proposals[0]]);
});
test("analysis filters inspect only source evidence inside the candidate", () => {
  const rows: Segment[] = [
    { start: 1, end: 4, words: [], text: "good opening" },
    { start: 8, end: 11, words: [], text: "unwanted" },
  ];
  const s = {
    ...defaults,
    analysisFrom: 0,
    analysisTo: 5,
    minimumScore: 60,
    includeWords: "opening",
    excludeWords: "unwanted",
  };
  assert.deepEqual(analysisWindows(rows, 11, s)[0].chunk, [rows[0]]);
  const h = { start: 0, end: 4, score: 70 } as Highlight;
  assert.equal(passesRules(h, rows, s), true);
  assert.equal(passesRules({ ...h, end: 10 }, rows, s), false);
});
test("workflow rejects disconnected, circular and duplicate steps", () => {
  const w: Workflow = {
    version: 1,
    nodes: ["analyze", "render"],
    edges: [["analyze", "render"]],
    settings: defaults,
  };
  assert.equal(compileWorkflow(w).captions, false);
  assert.throws(() => compileWorkflow({ ...w, edges: [] }));
  assert.throws(() =>
    compileWorkflow({ ...w, edges: [["render", "analyze"]] }),
  );
  assert.throws(() =>
    compileWorkflow({ ...w, nodes: ["analyze", "render", "render"] }),
  );
});
test("composition versioning and interpolation enforce explicit timeline offsets", () => {
  assert.deepEqual(validateComposition({ version: 1, tracks: [] }).tracks, []);
  assert.throws(() => validateComposition({ version: 2 as 1, tracks: [] }));
  assert.equal(curve([], 0.25, 4), "0.25");
  assert.match(
    curve(
      [
        { time: 0, value: 0, ease: "linear" },
        { time: 2, value: 1, ease: "hold" },
      ],
      0,
      3,
    ),
    /lt\(t,5\)/,
  );
  assert.equal(
    sampleCurve(
      [
        { time: 0, value: 0, ease: "linear" },
        { time: 2, value: 1, ease: "hold" },
      ],
      0,
      1,
    ),
    0.5,
  );
  assert.equal(
    layerPose(
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "L",
        asset: "22222222-2222-4222-8222-222222222222",
        type: "image",
        at: 0,
        length: 2,
        slip: 0,
        x: 0.5,
        y: 0.5,
        size: 0.4,
        opacity: 1,
        volume: 1,
        visible: true,
        muted: true,
        locked: false,
        solo: false,
        loop: true,
        fade: 0,
        keys: {
          opacity: [
            { time: 0, value: 0, ease: "linear" },
            { time: 1, value: 1, ease: "hold" },
          ],
        },
      },
      0.5,
    ).opacity,
    0.5,
  );
});
test("animation presets write renderable entrance and exit keyframes", () => {
  const track = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Inset",
    asset: "22222222-2222-4222-8222-222222222222",
    type: "image" as const,
    at: 0,
    length: 2,
    slip: 0,
    x: 0.5,
    y: 0.5,
    size: 0.4,
    opacity: 1,
    volume: 1,
    visible: true,
    muted: true,
    locked: false,
    solo: false,
    loop: true,
    fade: 0,
    keys: {},
  };
  assert.equal(animationPresets.length, 12);
  const faded = applyAnimationPreset(track, "fade-in");
  assert.equal(faded.keys.opacity?.[0]?.value, 0);
  assert.equal(faded.keys.opacity?.at(-1)?.value, 1);
  const zoomed = applyAnimationPreset(track, "zoom-out");
  assert.ok((zoomed.keys.size?.at(-1)?.value ?? 1) < track.size);
  validateComposition({ version: 1, tracks: [faded, { ...zoomed, id: "33333333-3333-4333-8333-333333333333" }] });
  assert.throws(() =>
    applyAnimationPreset({ ...track, type: "audio", muted: false }, "fade-in"),
  );
});
test("media proxy files use dedicated proxy.mp4 names under uploads and assets", () => {
  assert.match(
    proxyPath({
      kind: "source",
      project: "11111111-1111-4111-8111-111111111111",
    }),
    /[\\/]uploads[\\/]11111111-1111-4111-8111-111111111111\.proxy\.mp4$/,
  );
  assert.match(
    proxyPath({ kind: "asset", id: "22222222-2222-4222-8222-222222222222" }),
    /[\\/]assets[\\/]22222222-2222-4222-8222-222222222222\.proxy\.mp4$/,
  );
});
test("preview cache keys change when settings or media fingerprints change", () => {
  const base = previewKey(
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    0,
    5,
    0,
    3,
    defaults,
    ["upload:1"],
  );
  assert.equal(base.length, 64);
  assert.notEqual(
    base,
    previewKey(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      0,
      5,
      0,
      3,
      { ...defaults, opacity: 0.5 },
      ["upload:1"],
    ),
  );
  assert.notEqual(
    base,
    previewKey(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      0,
      5,
      0,
      3,
      defaults,
      ["upload:2"],
    ),
  );
});
test("timeline gestures move, trim and respect locked tracks", () => {
  const track = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "B-roll",
    asset: "22222222-2222-4222-8222-222222222222",
    type: "video" as const,
    at: 1,
    length: 2,
    slip: 0.5,
    x: 0.5,
    y: 0.5,
    size: 0.4,
    opacity: 1,
    volume: 1,
    visible: true,
    muted: false,
    locked: false,
    solo: false,
    loop: false,
    fade: 0,
    keys: {},
  };
  assert.equal(dragTrack([track], track.id, "move", 0.5, 10)[0].at, 1.5);
  assert.equal(
    dragTrack([track], track.id, "trim-end", 1, 10)[0].length,
    3,
  );
  const trimmed = dragTrack([track], track.id, "trim-start", 0.5, 10)[0];
  assert.equal(trimmed.at, 1.5);
  assert.equal(trimmed.length, 1.5);
  assert.equal(trimmed.slip, 1);
  assert.equal(
    dragTrack([{ ...track, locked: true }], track.id, "move", 1, 10)[0].at,
    1,
  );
  const peer = {
    ...track,
    id: "33333333-3333-4333-8333-333333333333",
    group: "44444444-4444-4444-8444-444444444444",
    at: 2,
  };
  const grouped = dragTrack(
    [
      { ...track, group: peer.group },
      peer,
    ],
    track.id,
    "move",
    0.25,
    10,
  );
  assert.equal(grouped[0].at, 1.25);
  assert.equal(grouped[1].at, 2.25);
});
test("layer scale keyframes stay within size bounds and reject audio tracks", () => {
  const base = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Inset",
    asset: "22222222-2222-4222-8222-222222222222",
    type: "image" as const,
    at: 0,
    length: 2,
    slip: 0,
    x: 0.5,
    y: 0.5,
    size: 0.4,
    opacity: 1,
    volume: 1,
    visible: true,
    muted: true,
    locked: false,
    solo: false,
    loop: true,
    fade: 0,
    keys: {
      size: [
        { time: 0, value: 0.2, ease: "in" as const },
        { time: 1, value: 0.8, ease: "out" as const },
      ],
    },
  };
  assert.equal(validateComposition({ version: 1, tracks: [base] }).tracks.length, 1);
  assert.throws(() =>
    validateComposition({
      version: 1,
      tracks: [
        {
          ...base,
          keys: { size: [{ time: 0, value: 0.01, ease: "linear" }] },
        },
      ],
    }),
  );
  assert.throws(() =>
    validateComposition({
      version: 1,
      tracks: [{ ...base, type: "audio", muted: false, keys: { size: base.keys.size } }],
    }),
  );
});

import { importMeasurements } from "../lib/metrics-csv";
test("CSV preserves zero, accepts quoted numbers and rejects bad rows before import", () => {
  assert.deepEqual(importMeasurements('clip,views,likes\na,"1,234",0'), [
    { clip: "a", values: { views: 1234, likes: 0 } },
  ]);
  assert.throws(() => importMeasurements("clip,completionPercent\na,110"));
  assert.throws(() => importMeasurements("clip,views\na,1\na,2"));
});

import { validCrop, cropAt } from "../lib/reframe";
import { chatBins, windowEvidence } from "../lib/activity-evidence";
import { parseCube } from "../lib/lut";
test("crop keys interpolate in source time and reject invalid coordinates", () => {
  const keys = validCrop([
    { time: 10, x: 0, y: 1 },
    { time: 20, x: 1, y: 0 },
  ]);
  assert.deepEqual(cropAt(keys, 15), { x: 0.5, y: 0.5 });
  assert.throws(() => validCrop([{ time: 0, x: 2, y: 0 }]));
});
test("activity evidence keeps absent inputs distinct from observed silence", () => {
  assert.throws(() => chatBins([-1], 20));
  const counts = chatBins([0, 10, 20], 20);
  assert.equal(
    counts.reduce((a, b) => a + b, 0),
    3,
  );
  const [bin] = windowEvidence(
    0,
    20,
    20,
    { peaks: [0, 0], scenes: [4] },
    counts,
  );
  assert.equal(bin.audioPeak, 0);
  assert.equal(bin.chatActivity, 3);
  assert.equal(bin.sceneChanges, 1);
  assert.equal(windowEvidence(0, 20, 20, null)[0].chatActivity, undefined);
});
test("cube parser rejects incomplete volumes and extra directives", () => {
  assert.throws(() => parseCube("LUT_3D_SIZE 2\n1 0 0"));
  assert.throws(() => parseCube("LUT_3D_SIZE 2\nIMPORT another_file"));
});

import { coordinates } from "../lib/vision-crop";
test("sampled frame recommendations reject invalid focal points", () => {
  assert.deepEqual(coordinates({ x: 0, y: 1 }), { x: 0, y: 1 });
  assert.throws(() => coordinates({ x: -1, y: 0.3 }));
  assert.throws(() => coordinates({ x: Infinity, y: 0.5 }));
});

import {
  atempoChain,
  outputDuration,
  sampleRate,
  speedSegments,
  validateSpeedCurve,
} from "../lib/speed-curve";
test("speed curves validate, sample and estimate output duration", () => {
  const points = validateSpeedCurve(
    [
      { time: 0, rate: 1 },
      { time: 2, rate: 2 },
    ],
    4,
  );
  assert.equal(sampleRate(points, 1, 1), 1.5);
  assert.ok(Math.abs(outputDuration(points, 4, 1) - (2 / 1.5 + 1)) < 0.001);
  assert.equal(speedSegments(points, 4, 1).length, 2);
  assert.match(atempoChain(3), /atempo=2/);
  assert.throws(() => validateSpeedCurve([{ time: 0, rate: 8 }], 2));
});

import { gradeFilters, validateEffectStack } from "../lib/grading";
test("effect stacks apply multiple timed filters in order", () => {
  const stack = validateEffectStack([
    {
      id: "11111111-1111-4111-8111-111111111111",
      effect: "blur",
      amount: 0.4,
      enabled: true,
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      effect: "vignette",
      amount: 0.7,
      enabled: true,
      from: 0.2,
      to: 1,
    },
  ]);
  const filters = gradeFilters({ effect: "sepia", amount: 1 }, 720, 1280, stack);
  assert.ok(filters.some((f) => f.includes("gblur")));
  assert.ok(filters.some((f) => f.includes("vignette")));
  assert.ok(!filters.some((f) => f.includes("colorchannelmixer=rr=0.393")));
  assert.throws(() =>
    validateEffectStack([
      {
        id: "11111111-1111-4111-8111-111111111111",
        effect: "blur",
        amount: 2,
        enabled: true,
      },
    ]),
  );
});

import { detectBeats, snapToBeats } from "../lib/beat-detect";
test("applyChromaKey zeroes pixels matching the key color", () => {
  const image = {
    data: new Uint8ClampedArray([
      0, 255, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255, 255, 0, 0, 255,
    ]),
    width: 2,
    height: 2,
  };
  const ctx = {
    getImageData: () => image,
    putImageData: () => {},
  } as unknown as CanvasRenderingContext2D;
  applyChromaKey(ctx, 2, 2, { color: "#00ff00", similarity: 0.35, blend: 0.1 });
  assert.equal(image.data[3], 0);
  assert.ok(image.data[7] > 0);
});

test("text composition tracks validate with the nil asset id", () => {
  assert.doesNotThrow(() =>
    validateComposition({
      version: 1,
      tracks: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          name: "Label",
          type: "text",
          asset: "00000000-0000-0000-0000-000000000000",
          text: "Hi",
          color: "#ffffff",
          fontSize: 48,
          at: 0,
          length: 2,
          slip: 0,
          x: 0.5,
          y: 0.5,
          size: 0.2,
          opacity: 1,
          volume: 1,
          visible: true,
          muted: true,
          locked: false,
          solo: false,
          loop: false,
          fade: 0,
          keys: {},
        },
      ],
    }),
  );
});

test("beat detection finds periodic onsets and supports snapping", () => {
  const rate = 22050;
  const duration = 4;
  const samples = new Float32Array(rate * duration);
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate;
    const click = Math.abs(t % 0.5) < 0.01 ? 1 : 0;
    samples[i] = click * (0.5 + 0.5 * Math.random());
  }
  const result = detectBeats(samples, rate, duration);
  assert.ok(result.beats.length >= 4);
  assert.ok(result.bpm > 100 && result.bpm < 140);
  assert.equal(snapToBeats(0.52, result.beats, 0.15), result.beats.find(b => Math.abs(b.time-0.5)<0.05)?.time || 0.52);
});

import {
  builtinTemplates,
  deleteTemplate,
  listTemplates,
  saveTemplate,
} from "../lib/templates";
test("editing templates validate settings and round-trip through workspace storage", async () => {
  const builtins = builtinTemplates();
  assert.ok(builtins.length >= 3);
  assert.equal(builtins[0].settings.ratio, "9:16");
  const saved = await saveTemplate({
    name: "Unit template",
    category: "Test",
    description: "temporary",
    settings: builtins[0].settings,
  });
  try {
    assert.equal(saved.name, "Unit template");
    const listed = await listTemplates();
    assert.ok(listed.some((row) => row.id === saved.id));
  } finally {
    await deleteTemplate(saved.id);
  }
});

import {
  mergeCaptions,
  replaceCaptionText,
  splitCaption,
} from "../lib/caption-track";
test("caption track helpers split, merge and replace timed lines", () => {
  const rows: Segment[] = [
    {
      start: 0,
      end: 2,
      text: "hello world",
      words: [
        { word: "hello", start: 0, end: 1 },
        { word: "world", start: 1, end: 2 },
      ],
    },
    { start: 2, end: 3, text: "again", words: [] },
  ];
  const split = splitCaption(rows, 0);
  assert.equal(split.length, 3);
  assert.equal(split[0].end, 1);
  assert.equal(split[1].start, 1);
  const merged = mergeCaptions(rows, 0);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].text, "hello world again");
  assert.equal(replaceCaptionText(rows, "world", "there")[0].text, "hello there");
});

import { adjustmentFilters, validateAdjustmentLayers } from "../lib/grading";
test("adjustment layers emit timed effect filters over composition ranges", () => {
  const layers = validateAdjustmentLayers([
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Glow pass",
      at: 0.5,
      length: 2,
      enabled: true,
      effects: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          effect: "glow",
          amount: 0.4,
          enabled: true,
        },
      ],
    },
  ]);
  const filters = adjustmentFilters(layers, 1080);
  assert.ok(filters.some((f) => f.includes("unsharp") && f.includes("between(t,0.5")));
});
