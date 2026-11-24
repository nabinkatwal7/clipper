import test from "node:test";
import assert from "node:assert/strict";
import { postCaption, captionFile, clipBasename } from "../lib/post-captions";
import { validateHighlights } from "../lib/validation";
import { defaults } from "../lib/types";
test("post caption text exports UTF-8 content and falls back honestly to the existing title", () => {
  assert.equal(
    captionFile({
      title: "Clip",
      postCaption: "  A real moment! 🎬\n#Gaming  ",
    }),
    "A real moment! 🎬\n#Gaming\n",
  );
  assert.equal(postCaption({ title: "Existing title" }), "Existing title");
});
test("video and text filenames share a safe basename and unique clip suffix", () => {
  const base = clipBasename({
    id: "12345678-1234-1234-1234-123456789abc",
    title: '../../bad "title" 🎬',
  });
  assert.equal(base, "bad title-123456");
  assert.ok(!base.includes("/"));
});
test("AI selection preserves validated post captions without breaking older highlight records", () => {
  const highlight = {
    start: 0,
    end: 40,
    title: "Moment",
    reason: "Story",
    score: 80,
    postCaption: "  The story behind the moment. #Story  ",
  };
  assert.equal(
    validateHighlights([highlight], 60, defaults)[0].postCaption,
    "The story behind the moment. #Story",
  );
  assert.equal(
    validateHighlights([{ ...highlight, postCaption: 123 }], 60, defaults)[0]
      .postCaption,
    undefined,
  );
});
