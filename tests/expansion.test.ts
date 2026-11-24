import test from "node:test";
import assert from "node:assert/strict";
import { validateProposals } from "../lib/director";
import { compileWorkflow, type Workflow } from "../lib/workflow";
import { analysisWindows, passesRules } from "../lib/discovery";
import { defaults, type Highlight, type Segment } from "../lib/types";
import { curve, validateComposition } from "../lib/composition";
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
});

import { importMeasurements } from "../lib/metrics-csv";
test("CSV preserves zero, accepts quoted numbers and rejects bad rows before import", () => {
  assert.deepEqual(importMeasurements('clip,views,likes\na,"1,234",0'), [
    { clip: "a", values: { views: 1234, likes: 0 } },
  ]);
  assert.throws(() => importMeasurements("clip,completionPercent\na,110"));
  assert.throws(() => importMeasurements("clip,views\na,1\na,2"));
});
