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

import { bezierControls, cubicBezier } from "../lib/keyframe-curve";
test("custom Bézier control points change sampled curves", () => {
  const a = {
    time: 0,
    value: 0,
    ease: "bezier" as const,
    cx1: 0,
    cy1: 0,
    cx2: 1,
    cy2: 1,
  };
  const b = { time: 1, value: 1, ease: "hold" as const };
  assert.ok(Math.abs(sampleCurve([a, b], 0, 0.5) - 0.5) < 0.05);
  assert.deepEqual(bezierControls(a), [0, 0, 1, 1]);
  assert.ok(cubicBezier(0.5, 0.42, 0, 0.58, 1) > 0.4);
});

import { trackPoint } from "../lib/motion-track";
test("block-match motion tracker follows a shifted bright block", () => {
  const w = 32,
    h = 32;
  const mk = (ox: number, oy: number) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < 6; y++)
      for (let x = 0; x < 6; x++) {
        const i = ((oy + y) * w + (ox + x)) * 4;
        data[i] = data[i + 1] = data[i + 2] = 255;
        data[i + 3] = 255;
      }
    return { width: w, height: h, data };
  };
  const path = trackPoint([mk(4, 4), mk(10, 5)], [0, 0.2], 7 / 32, 7 / 32, 8, 5);
  assert.equal(path.length, 2);
  assert.ok(path[1].x > path[0].x);
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

import {
  emptySequence,
  migrateComposition,
  validateProjectDocument,
} from "../lib/sequences";
import { studioGroups, livePages } from "../lib/studios";
test("project sequences migrate legacy compositions and reject cycles", () => {
  const migrated = migrateComposition({ version: 1, tracks: [] });
  assert.equal(migrated.schemaVersion, 1);
  assert.equal(migrated.sequences.length, 1);
  assert.equal(migrated.activeSequence, migrated.sequences[0].id);
  const a = emptySequence("A");
  const b = emptySequence("B");
  a.nestedOf = b.id;
  b.nestedOf = a.id;
  assert.throws(() =>
    validateProjectDocument({
      schemaVersion: 1,
      sequences: [a, b],
    }),
  );
  const ok = validateProjectDocument({
    schemaVersion: 1,
    sequences: [emptySequence("Main"), emptySequence("Alt")],
  });
  assert.equal(ok.sequences.length, 2);
});
test("studio registry exposes live pages without planned routes", () => {
  assert.ok(studioGroups.some((g) => g.id === "editing"));
  const pages = livePages();
  assert.ok(pages.includes("Video editor"));
  assert.ok(pages.includes("Motion Studio"));
  assert.ok(pages.includes("Soundboard"));
  assert.ok(pages.includes("Recording Studio"));
  assert.ok(pages.includes("Instant replay"));
  assert.ok(pages.includes("Compositing Studio"));
  assert.ok(pages.includes("Tutorial tools"));
  assert.ok(pages.includes("Review Studio"));
  assert.ok(pages.includes("Design Studio"));
  assert.ok(pages.includes("Image editor"));
  assert.ok(pages.includes("AI Laboratory"));
  assert.ok(
    !studioGroups
      .flatMap((g) => g.routes)
      .some((r) => r.id === "three-d" && r.page),
  );
});

import {
  clipFromSelection,
  deleteDialogue,
  emptyCutState,
  overrideCaption,
  transcriptComparison,
} from "../lib/transcript-edit";
test("transcript cuts are non-destructive and caption overrides leave media ranges", () => {
  const rows = [
    { start: 0, end: 2, text: "hello", words: [] },
    { start: 2, end: 4, text: "world", words: [] },
    { start: 4, end: 6, text: "again", words: [] },
  ];
  let state = emptyCutState(6);
  state = deleteDialogue(state, rows, [1]);
  assert.deepEqual(state.keep, [
    { start: 0, end: 2 },
    { start: 4, end: 6 },
  ]);
  assert.deepEqual(state.removed, [{ start: 2, end: 4 }]);
  const withCaption = overrideCaption(state, 0, "Hi");
  assert.deepEqual(withCaption.keep, state.keep);
  assert.equal(withCaption.captionOverrides[0].text, "Hi");
  const clip = clipFromSelection(rows, [0, 1]);
  assert.equal(clip.start, 0);
  assert.equal(clip.end, 4);
  const cmp = transcriptComparison(rows, state);
  assert.equal(cmp.removedText.join(" "), "world");
  assert.ok(cmp.editedDuration < cmp.originalDuration || cmp.editedDuration === 4);
});

import {
  detectOverlaps,
  validateCutSession,
  cutModeHelp,
} from "../lib/fast-cut";
test("fast-cut sessions validate modes and detect overlaps", () => {
  const a = {
    id: "11111111-1111-4111-8111-111111111111",
    start: 0,
    end: 5,
    label: "A",
  };
  const b = {
    id: "22222222-2222-4222-8222-222222222222",
    start: 4,
    end: 8,
    label: "B",
  };
  assert.equal(detectOverlaps([a, b]).length, 1);
  assert.match(cutModeHelp("lossless"), /keyframe/i);
  const session = validateCutSession({
    version: 1,
    sourceProject: "33333333-3333-4333-8333-333333333333",
    mode: "accurate",
    segments: [a],
  });
  assert.equal(session.mode, "accurate");
  assert.throws(() =>
    validateCutSession({ version: 1, sourceProject: "x", mode: "lossless", segments: [] }),
  );
});

import {
  dictionarySuggestions,
  applyApprovedRemovals,
} from "../lib/dialogue-suggestions-core";
import { validateReelJob } from "../lib/reel-factory";
import { emptyMemory, validateMemory, mergeEvidence } from "../lib/creator-memory";
test("dialogue dictionaries propose removable filler and pause ranges", () => {
  const rows = [
    { start: 0, end: 1, text: "um", words: [] },
    { start: 1, end: 3, text: "hello there everyone", words: [] },
    { start: 6, end: 8, text: "hello there everyone", words: [] },
  ];
  const sug = dictionarySuggestions(rows, "en");
  assert.ok(sug.some((s) => s.kind === "filler"));
  assert.ok(sug.some((s) => s.kind === "pause" || s.kind === "repeat"));
  const keep = applyApprovedRemovals(
    [{ start: 0, end: 8 }],
    sug.map((s) => ({ ...s, approved: s.kind === "filler" })),
  );
  assert.ok(keep.every((r) => r.end > r.start));
});
test("reel factory and creator memory validate structured local data", () => {
  const job = validateReelJob({
    version: 1,
    name: "Batch",
    sources: ["11111111-1111-4111-8111-111111111111"],
    clipCount: 5,
    minScore: 50,
    duration: "30-60",
    layout: "center",
    style: "bold",
    ratio: "9:16",
    resolution: "1080",
    captions: true,
    reviewRequired: true,
    categories: [],
    language: "en",
    status: "draft",
    results: [],
  });
  assert.equal(job.clipCount, 5);
  const mem = validateMemory(emptyMemory("Streamer"));
  const merged = mergeEvidence(mem, { topics: ["football"] });
  assert.ok(merged.topics.includes("football"));
});

import {
  validateRoughCutPlan,
  planToCutState,
} from "../lib/rough-cut";
import {
  validateBinTree,
  createBin,
  emptyBinTree,
} from "../lib/project-bins";
import {
  ensureSequences,
  duplicateSequence,
  nestSequence,
} from "../lib/sequences";
test("rough cut plans validate ranges and convert to cut state", () => {
  const plan = validateRoughCutPlan(
    {
      title: "Summary",
      why: "Keeps the explanation",
      ranges: [
        { start: 1, end: 10 },
        { start: 20, end: 35 },
      ],
    },
    60,
  );
  assert.equal(plan.estimatedDuration, 24);
  const cut = planToCutState(plan, 60);
  assert.equal(cut.keep.length, 2);
  assert.ok(cut.removed.length >= 1);
  assert.throws(() =>
    validateRoughCutPlan(
      { title: "x", why: "y", ranges: [{ start: 1, end: 2 }, { start: 1.5, end: 3 }] },
      60,
    ),
  );
});
test("project bins and sequences reject cycles and support duplicates", () => {
  let tree = createBin(emptyBinTree(), "Root");
  const root = tree.bins[0].id;
  tree = createBin(tree, "Child", root);
  assert.equal(tree.bins.length, 2);
  assert.throws(() =>
    validateBinTree({
      version: 1,
      bins: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "A",
          parentId: "22222222-2222-4222-8222-222222222222",
          items: [],
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "B",
          parentId: "11111111-1111-4111-8111-111111111111",
          items: [],
          createdAt: "",
          updatedAt: "",
        },
      ],
    }),
  );
  let doc = ensureSequences({ composition: { version: 1, tracks: [] } });
  doc = duplicateSequence(doc, doc.sequences[0].id, "Alt");
  assert.equal(doc.sequences.length, 2);
  assert.throws(() =>
    nestSequence(doc, doc.sequences[0].id, doc.sequences[0].id),
  );
});

import {
  applyRecipe,
  recipeFromSettings,
  validateRecipe,
  defaultVerticalRecipe,
} from "../lib/edit-recipes";
test("edit recipes apply structured ops without inventing media", () => {
  const recipe = defaultVerticalRecipe();
  assert.ok(recipe.operations.length >= 3);
  const next = applyRecipe(defaults, recipe);
  assert.equal(next.ratio, "9:16");
  assert.equal(next.captions, true);
  const captured = recipeFromSettings("Copy", next, "from clip");
  assert.equal(validateRecipe(captured).name, "Copy");
  assert.throws(() =>
    validateRecipe({ version: 1, id: "bad", name: "x", description: "", operations: [] }),
  );
});

import { buildClipFamily } from "../lib/clip-family";
import {
  validateProfile,
  buildConvertArgs,
  batchConvert,
} from "../lib/media-toolbox";
import { uuid } from "../lib/id";
test("clip family preserves source provenance without inventing clips", () => {
  const tree = buildClipFamily({
    id: "11111111-1111-4111-8111-111111111111",
    title: "Stream",
    duration: 120,
    clips: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        start: 10,
        end: 40,
        title: "Highlight",
        reason: "test",
        score: 80,
        segments: [],
        settings: { ...defaults, ratio: "9:16", layout: "center" },
      } as never,
    ],
  } as never);
  assert.ok(tree.nodes.some((n) => n.kind === "source"));
  assert.ok(tree.edges.length >= 1);
});
test("media toolbox validates codec/container pairs", () => {
  const profile = validateProfile({
    container: "mp4",
    videoCodec: "copy",
    audioCodec: "copy",
  });
  const args = buildConvertArgs("in.mp4", "out.mp4", profile);
  assert.ok(args.includes("copy"));
  assert.throws(() =>
    validateProfile({ container: "webm", videoCodec: "copy", audioCodec: "aac" }),
  );
  assert.match(uuid(), /^[0-9a-f-]{36}$/i);
});
test("media toolbox batch convert rejects empty project lists", async () => {
  const profile = validateProfile({
    container: "mp4",
    videoCodec: "copy",
    audioCodec: "copy",
  });
  await assert.rejects(() => batchConvert([], profile));
});

import { computeSpectrogram, fft } from "../lib/spectrogram";
import { validateRestorePlan, restoreFilters } from "../lib/audio-restore";
import { compositionFingerprint } from "../lib/render-replace";
test("spectrogram FFT produces bounded magnitude frames", () => {
  const n = 1024;
  const samples = new Float32Array(n * 4);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
  const matrix = computeSpectrogram(samples, { fftSize: 512, hopSize: 128 });
  assert.equal(matrix.rows, 256);
  assert.ok(matrix.cols > 1);
  assert.ok([...matrix.data].every((v) => v >= 0 && v <= 1));
  const re = new Float64Array([1, 0, 0, 0]);
  const im = new Float64Array(4);
  fft(re, im);
  assert.ok(Number.isFinite(re[0]));
});
test("audio restore plans compile to ffmpeg filters", () => {
  const plan = validateRestorePlan({
    version: 1,
    ops: [
      { op: "highpass", hz: 80 },
      { op: "notch", hz: 50, q: 30 },
      { op: "normalize", targetDb: -16 },
    ],
  });
  const filters = restoreFilters(plan);
  assert.ok(filters.some((f) => f.includes("highpass")));
  assert.ok(filters.some((f) => f.includes("loudnorm")));
  assert.equal(
    compositionFingerprint({ version: 1, tracks: [] }).length,
    24,
  );
});

import {
  emptyProfile,
  emptySequencer,
  validatePad,
  validateProfile as validateSoundboard,
  validateSequencer,
} from "../lib/soundboard";
import {
  defaultScenes,
  validateScene,
  newSession,
  validateTrackAsset,
} from "../lib/recording-meta";
test("soundboard validates pads, profiles and sequencer lanes", () => {
  const padId = "11111111-1111-4111-8111-111111111111";
  const assetId = "22222222-2222-4222-8222-222222222222";
  const pad = validatePad({
    id: padId,
    label: "Hit",
    assetId,
    volume: 0.8,
    loop: false,
    key: "1",
  });
  assert.equal(pad.label, "Hit");
  const profile = validateSoundboard({
    ...emptyProfile("SFX"),
    pads: [pad],
  });
  assert.equal(profile.pads.length, 1);
  const seq = emptySequencer();
  seq.patterns[0].lanes[padId] = Array(16).fill(false);
  seq.patterns[0].lanes[padId][0] = true;
  const ok = validateSequencer(seq);
  assert.equal(ok.tempo, 120);
  assert.throws(() =>
    validateSequencer({
      ...seq,
      patterns: [{ ...seq.patterns[0], steps: 12 }],
    }),
  );
});
test("recording scenes and sessions stay bounded", () => {
  assert.ok(defaultScenes.length >= 3);
  const scene = validateScene(defaultScenes[0]);
  assert.equal(scene.layout, "fullscreen");
  const session = newSession(scene.id);
  assert.equal(session.version, 1);
  assert.equal(session.bookmarks.length, 0);
  assert.throws(() =>
    validateScene({ ...defaultScenes[0], layout: "orbital" }),
  );
  const track = validateTrackAsset({
    role: "microphone",
    assetId: "33333333-3333-4333-8333-333333333333",
  });
  assert.equal(track.role, "microphone");
  assert.throws(() =>
    validateTrackAsset({ role: "laser", assetId: track.assetId }),
  );
});

import {
  bookmarkWindow,
  validateReplaySeconds,
  REPLAY_SECONDS,
} from "../lib/instant-replay";
test("instant replay windows stay bounded and validated", () => {
  assert.ok(REPLAY_SECONDS.includes(30));
  assert.equal(validateReplaySeconds(90), 90);
  assert.throws(() => validateReplaySeconds(45));
  const win = bookmarkWindow(40, 10, 5, 120);
  assert.equal(win.start, 30);
  assert.equal(win.end, 45);
  const edge = bookmarkWindow(2, 10, 5, 20);
  assert.equal(edge.start, 0);
  assert.ok(edge.end <= 20);
  assert.throws(() => bookmarkWindow(150, 0, 400, 600));
});

import {
  emptyGraph,
  createNode,
  validateGraph,
  compileGraph,
  topoOrder,
  buildBakePlan,
} from "../lib/comp-graph";
test("compositing graphs reject cycles and compile connected outputs", () => {
  const g = emptyGraph("Test");
  const blur = createNode("effect.blur", 200, 120);
  g.nodes.push(blur);
  g.edges.push({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    from: g.nodes[0].id,
    fromPort: "out",
    to: blur.id,
    toPort: "in",
  });
  g.edges.push({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    from: blur.id,
    fromPort: "out",
    to: g.nodes[1].id,
    toPort: "in",
  });
  const ok = validateGraph(g);
  assert.equal(topoOrder(ok).length, 3);
  const plan = compileGraph(ok);
  assert.ok(plan.steps.some((s) => s.includes("gblur")));
  assert.ok(plan.outputs.length);
  const a = createNode("comp.merge", 0, 0);
  const b = createNode("comp.merge", 100, 0);
  assert.throws(() =>
    validateGraph({
      version: 1,
      id: g.id,
      name: "cycle",
      updatedAt: new Date().toISOString(),
      nodes: [a, b],
      edges: [
        {
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          from: a.id,
          fromPort: "out",
          to: b.id,
          toPort: "base",
        },
        {
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          from: b.id,
          fromPort: "out",
          to: a.id,
          toPort: "base",
        },
      ],
    }),
  );
});
test("compositing bake plan emits filter_complex for solid→blur→out", () => {
  const solid = createNode("source.solid", 0, 0);
  solid.color = "#112233";
  const blur = createNode("effect.blur", 100, 0);
  blur.blur = 4;
  const out = createNode("output.video", 200, 0);
  const g = validateGraph({
    version: 1,
    id: "11111111-1111-4111-8111-111111111111",
    name: "Bake",
    updatedAt: new Date().toISOString(),
    nodes: [solid, blur, out],
    edges: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        from: solid.id,
        fromPort: "out",
        to: blur.id,
        toPort: "in",
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        from: blur.id,
        fromPort: "out",
        to: out.id,
        toPort: "in",
      },
    ],
  });
  const bake = buildBakePlan(g, new Map(), { duration: 2, width: 640, height: 360 });
  assert.match(bake.filterComplex, /gblur=sigma=4/);
  assert.match(bake.filterComplex, /color=c=0x112233/);
  assert.equal(bake.duration, 2);
  assert.ok(bake.mapLabel);
});

import {
  buildMotionTitlePreset,
  sampleMotionLayers,
  motionTitlePresets,
} from "../lib/motion-presets";
test("motion title presets emit animated layers sampleable on a timeline", () => {
  assert.ok(motionTitlePresets.length >= 4);
  const layers = buildMotionTitlePreset("lower-third", "Host Name");
  assert.ok(layers.length >= 2);
  assert.ok(layers.some((t) => t.type === "text"));
  assert.ok(layers.some((t) => Object.keys(t.keys).length));
  const mid = sampleMotionLayers(layers, 1);
  assert.ok(mid.length >= 1);
  assert.ok(mid.every((s) => s.opacity >= 0 && s.opacity <= 1));
  const early = sampleMotionLayers(layers, 0.05);
  assert.ok(Array.isArray(early));
});

import {
  emptyAnnotation,
  validateAnnotation,
  annotationsToTracks,
} from "../lib/tutorial-annotations";
test("tutorial annotations convert to composition tracks", () => {
  const a = validateAnnotation(emptyAnnotation("highlight", 1, "Menu"));
  assert.equal(a.kind, "highlight");
  const cursor = emptyAnnotation("cursor", 2, "Click here");
  const tracks = annotationsToTracks([a, cursor, emptyAnnotation("shortcut", 0, "Ctrl+C")]);
  assert.ok(tracks.some((t) => t.type === "shape"));
  assert.ok(tracks.some((t) => t.type === "text"));
  assert.throws(() =>
    validateAnnotation({ ...a, kind: "sparkle" }),
  );
});

import {
  emptyReviewItem,
  addComment,
  validateItem,
} from "../lib/review-studio";
test("review studio items accept timestamped comments and statuses", () => {
  const item = emptyReviewItem(
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    "Highlight",
  );
  assert.equal(item.status, "needs-review");
  const next = addComment(item, "Trim cold open", 1.5);
  assert.equal(next.comments.length, 1);
  assert.equal(validateItem({ ...next, status: "approved" }).status, "approved");
  assert.throws(() => addComment(item, "", 0));
});

import {
  emptyArtboard,
  validateArtboard,
  DESIGN_FORMATS,
  applyDesignVariables,
  bulkFromRows,
} from "../lib/design-studio";
import { emptyPrompt, validatePrompt } from "../lib/ai-lab";
test("design artboards and AI lab prompts validate local documents", () => {
  assert.ok(DESIGN_FORMATS.length >= 8);
  const board = validateArtboard(emptyArtboard("square-post", "Post"));
  assert.equal(board.width, 1080);
  assert.ok(board.layers.length >= 1);
  const filled = applyDesignVariables(
    {
      ...board,
      layers: board.layers.map((l) =>
        l.type === "text" ? { ...l, text: "Hi {{creator}}" } : l,
      ),
    },
    { creator: "Alex" },
  );
  assert.ok(filled.layers.some((l) => l.text?.includes("Alex")));
  const many = bulkFromRows(board, [
    { title: "A" },
    { title: "B" },
  ]);
  assert.equal(many.length, 2);
  const prompt = validatePrompt(emptyPrompt("Titles"));
  assert.ok(prompt.user.length);
  assert.throws(() =>
    validateArtboard({ ...board, width: 10 }),
  );
  assert.throws(() => validatePrompt({ ...prompt, user: "" }));
});

import {
  validateAdjustments,
  validateTransform,
  applyPixelAdjustments,
  defaultAdjustments,
  defaultTransform,
} from "../lib/image-editor";
test("image editor adjustments clamp and rewrite pixels", () => {
  const adj = validateAdjustments({
    ...defaultAdjustments,
    brightness: 0.2,
    contrast: -0.1,
  });
  assert.equal(adj.brightness, 0.2);
  const xf = validateTransform(defaultTransform);
  assert.equal(xf.rotation, 0);
  const data = {
    width: 2,
    height: 2,
    data: new Uint8ClampedArray([
      10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255, 100, 110, 120, 255,
    ]),
  };
  const out = applyPixelAdjustments(data, adj);
  assert.equal(out.data.length, 16);
  assert.throws(() => validateAdjustments({ ...adj, brightness: 5 }));
});
