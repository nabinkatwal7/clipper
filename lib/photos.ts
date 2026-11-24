/** Unsplash photos (https://unsplash.com/license). IDs were checked to resolve; alt text describes each image. */
export const photo = (id: string, w = 1200, h = 800) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=70`;

export const photos = {
  timeline: ["1574717024653-61fd2cf4d44d", "Video editing timeline with colour-coded clips"],
  monitor: ["1492619375914-88005aa9e8fb", "Editing software open on a desktop monitor"],
  clapper: ["1485846234645-a62644f84728", "Hands holding a film clapperboard outdoors"],
  clapperYellow: ["1598899134739-24c46f58b8c0", "Clapperboard and popcorn on a yellow background"],
  laptopHands: ["1516321318423-f06f85e504b3", "People pointing at a laptop screen"],
  code: ["1517694712202-14dd9538aa97", "Laptop showing code beside a plant"],
  codeDark: ["1555066931-4365d14bab8c", "Dark laptop screen with colourful code"],
  desk: ["1498050108023-c5249f4df085", "Laptop and monitor on a bright desk"],
  laptopArt: ["1593642632823-8f785ba67e45", "Laptop on a desk showing abstract artwork"],
  circuit: ["1550751827-4bd374c3f58b", "Glowing circuit board illustration"],
  chip: ["1518770660439-4636190af475", "Close-up of a computer chip on a circuit board"],
  matrix: ["1526374965328-7f61d4dc18c5", "Streams of green characters on a dark screen"],
  mic: ["1478737270239-2f02b77fc618", "Studio condenser microphone with a pop filter"],
  micArm: ["1590602847861-f357a9332bbc", "Microphone on a boom arm against a dark wall"],
  studioRoom: ["1511379938547-c1f69419868d", "Home studio with guitars, keyboard and a microphone"],
  camera: ["1516035069371-29a1b244cc32", "Camera bodies and lenses on a dark table"],
  gamer: ["1542751371-adc38448a05e", "Gamer at a desk with headphones and a glowing monitor"],
  streamDesk: ["1598550476439-6847785fcea6", "Streaming desk with two monitors and a camera on a tripod"],
  lecture: ["1524178232363-1fb2b075b655", "Speaker presenting to an audience in a conference room"],
  earth: ["1451187580459-43490279c0fa", "City lights across the Earth seen from orbit"],
  servers: ["1558494949-ef010cbdcc31", "Rack of servers with colourful cables"],
} as const;
export type PhotoKey = keyof typeof photos;

export const featurePhoto: Record<string, PhotoKey> = {
  overview: "desk", import: "clapper", projects: "monitor", library: "clapperYellow", assets: "laptopArt",
  discover: "matrix", editor: "timeline", director: "chip", compilations: "laptopHands", transcripts: "codeDark",
  subtitles: "code", thumbnails: "clapperYellow", streamers: "circuit", queue: "matrix", auto: "chip",
  workflows: "laptopHands", desk: "desk", calendar: "code", branding: "laptopArt", storage: "circuit",
};
