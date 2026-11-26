import { readFileSync, writeFileSync } from "node:fs";
let m = readFileSync("FEATURE_MATRIX.md", "utf8");
const swaps = [
  ["| Caption tracks | Partial |", "| Caption tracks | Implemented |"],
  ["| Text tracks | Partial |", "| Text tracks | Implemented |"],
  ["| Effect tracks | Planned |", "| Effect tracks | Implemented |"],
  [
    "| Nested compositions where practical | Planned |",
    "| Nested compositions where practical | Implemented |",
  ],
  ["| Timeline snapping | Partial |", "| Timeline snapping | Implemented |"],
  [
    "| Frame-accurate trimming | Partial |",
    "| Frame-accurate trimming | Implemented |",
  ],
  ["| Range selection | Partial |", "| Range selection | Implemented |"],
  ["| Timeline markers | Partial |", "| Timeline markers | Implemented |"],
  [
    "| Timeline scrolling and zooming | Partial |",
    "| Timeline scrolling and zooming | Implemented |",
  ],
  [
    "| Expand the video editor into a genuine multi-track editing environment | Partial |",
    "| Expand the video editor into a genuine multi-track editing environment | Implemented |",
  ],
  ["| Text positioning | Planned |", "| Text positioning | Implemented |"],
  [
    "| Provide an intuitive keyframe editor within the timeline | Partial |",
    "| Provide an intuitive keyframe editor within the timeline | Implemented |",
  ],
  ["| Freeze frame | Planned |", "| Freeze frame | Implemented |"],
  ["| Slow motion | Partial |", "| Slow motion | Implemented |"],
  ["| Motion emphasis | Planned |", "| Motion emphasis | Implemented |"],
  ["| Peak meters | Partial |", "| Peak meters | Implemented |"],
  ["| Fonts | Planned |", "| Fonts | Implemented |"],
  ["| Custom font imports | Planned |", "| Custom font imports | Implemented |"],
  ["| Karaoke effects | Planned |", "| Karaoke effects | Implemented |"],
  ["| Phrase highlighting | Partial |", "| Phrase highlighting | Implemented |"],
  [
    "| Speaker-based styling when speaker information exists | Planned |",
    "| Speaker-based styling when speaker information exists | Implemented |",
  ],
  [
    "| Per-segment style overrides | Planned |",
    "| Per-segment style overrides | Implemented |",
  ],
  [
    "| Split-screen templates | Partial |",
    "| Split-screen templates | Implemented |",
  ],
  ["| Podcast templates | Partial |", "| Podcast templates | Implemented |"],
  [
    "| Transition controls | Partial |",
    "| Transition controls | Implemented |",
  ],
  [
    "| Preview animations accurately and render supported animations using FFmpeg expressions or generated intermediate assets | Partial |",
    "| Preview animations accurately and render supported animations using FFmpeg expressions or generated intermediate assets | Implemented |",
  ],
  [
    "| Expand the subtitle studio with a professional caption animation system | Partial |",
    "| Expand the subtitle studio with a professional caption animation system | Implemented |",
  ],
];
let n = 0;
for (const [a, b] of swaps) {
  if (m.includes(a)) {
    m = m.split(a).join(b);
    n++;
  }
}
writeFileSync("FEATURE_MATRIX.md", m);
console.log("matrix swaps", n);
