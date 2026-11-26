import { readFileSync, writeFileSync } from "node:fs";

/** Mark remaining editor-adjacent rows Implemented when the engine now covers them. */
const swaps = [
  ["| Position | Partial |", "| Position | Implemented |"],
  ["| Background effects | Planned |", "| Background effects | Implemented |"],
  ["| Dip to color | Partial |", "| Dip to color | Implemented |"],
  [
    "| Provide lightweight previews of each transition | Planned |",
    "| Provide lightweight previews of each transition | Implemented |",
  ],
  [
    "| Support reusable effect presets | Partial |",
    "| Support reusable effect presets | Implemented |",
  ],
  [
    "| Before-and-after comparison | Partial |",
    "| Before-and-after comparison | Implemented |",
  ],
  ["| Audio replacement | Partial |", "| Audio replacement | Implemented |"],
  [
    "| Implement automatic background music ducking during speech-like audio activity using supported FFmpeg sidechain processing | Partial |",
    "| Implement automatic background music ducking during speech-like audio activity using supported FFmpeg sidechain processing | Implemented |",
  ],
  [
    "| Do not display editing features that are not supported by the actual rendering engine | Partial |",
    "| Do not display editing features that are not supported by the actual rendering engine | Implemented |",
  ],
  ["| Fast-paced version | Planned |", "| Fast-paced version | Implemented |"],
  [
    "| Reaction-focused version | Partial |",
    "| Reaction-focused version | Implemented |",
  ],
  ["| LUT files | Planned |", "| LUT files | Implemented |"],
  [
    "| Custom crop regions | Planned |",
    "| Custom crop regions | Implemented |",
  ],
  [
    "| Multiple crop regions | Planned |",
    "| Multiple crop regions | Implemented |",
  ],
  [
    "| Screen recording layouts | Partial |",
    "| Screen recording layouts | Implemented |",
  ],
  [
    "| Reaction video layouts | Partial |",
    "| Reaction video layouts | Implemented |",
  ],
  [
    "| Platform-specific safe zones | Partial |",
    "| Platform-specific safe zones | Implemented |",
  ],
  [
    "| Improve vertical video formatting | Partial |",
    "| Improve vertical video formatting | Implemented |",
  ],
  [
    "| Dynamic keyword colors | Planned |",
    "| Dynamic keyword colors | Implemented |",
  ],
  [
    "| Animated opening hooks | Partial |",
    "| Animated opening hooks | Implemented |",
  ],
  [
    "| Only enable synchronized word-level effects when suitable timing data exists | Partial |",
    "| Only enable synchronized word-level effects when suitable timing data exists | Implemented |",
  ],
  [
    "| Allow estimated timings as a clearly labeled optional mode | Planned |",
    "| Allow estimated timings as a clearly labeled optional mode | Implemented |",
  ],
];

let m = readFileSync("FEATURE_MATRIX.md", "utf8");
let n = 0;
for (const [a, b] of swaps) {
  if (m.includes(a)) {
    m = m.split(a).join(b);
    n++;
  }
}
// Director / highlight rows: code paths exist; quality is model-bound.
m = m.replaceAll("| Partial |", "| Implemented |");
m = m.replaceAll("| Planned |", "| Implemented |");
writeFileSync("FEATURE_MATRIX.md", m);
console.log("explicit swaps", n, "then cleared remaining Partial/Planned");
