export type Settings = {
  category?: string;
  instructions?: string;
  model?: string;
  captionColor?: string;
  captionBackground?:boolean; captionAnimation?:"none"|"fade";
  outline?: number;
  shadow?: number;
  font?: string;
  volume?: number;
  scale?:number; rotation?:number; opacity?:number; offsetY?:number;
  duration: "15-30" | "30-60" | "60-90";
  count: number;
  ratio: "9:16" | "1:1" | "4:5" | "16:9";
  resolution: "720" | "1080";
  captions: boolean;
  style: "minimal" | "bold" | "highlight";
  layout: "center" | "blur" | "crop" | "facecam" | "original";
  crop: number;
  fontSize: number;
  captionPosition: "bottom" | "middle" | "top";
  mode: "ai" | "manual" | "split";
  manualStart: number;
  manualEnd: number;
};
export const defaults: Settings = {
  duration: "30-60",
  count: 5,
  ratio: "9:16",
  resolution: "720",
  captions: true,
  style: "bold",
  layout: "center",
  crop: 50,
  fontSize: 64,
  captionPosition: "bottom",
  mode: "ai",
  manualStart: 0,
  manualEnd: 45,
};
export type Word = { start: number; end: number; word: string };
export type Segment = {
  start: number;
  end: number;
  text: string;
  words: Word[];
};
export type Highlight = {
  editorialId?: string;
  start: number;
  end: number;
  title: string;
  reason: string;
  score: number | null;
  postCaption?: string;
};
export type Clip = Highlight & {
  id: string;
  file: string;
  settings: Settings;
  segments: Segment[];
};
export type Project = {
  id: string;
  title: string;
  duration: number;
  width: number;
  height: number;
  thumbnail?: string;
  source?: string;
  status: "queued" | "processing" | "ready" | "error" | "cancelled";
  stage: string;
  detail: string;
  createdAt: string;
  updatedAt: string;
  settings: Settings;
  clips: Clip[];
  highlights: Highlight[];
  error?: string;
  progress?: Partial<Record<ProcessingStage, StageProgress>>;
};
export type ProcessingStage =
  "source-subtitles" | "indexing" | "importing" | "extracting" | "transcribing" | "analyzing" | "rendering";
export type StageProgress = {
  current: number;
  total: number;
  unit: "bytes" | "seconds" | "chunks" | "clips" | "steps";
  state: "active" | "complete";
  detail: string;
  startedAt: string;
  updatedAt: string;
  etaSeconds?: number;
};
