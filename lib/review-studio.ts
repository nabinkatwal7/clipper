import { promises as fs } from "node:fs";
import path from "node:path";
import { uuid } from "./id";
import { workspaceRoot } from "./store";

export type ReviewStatus =
  | "draft"
  | "needs-review"
  | "approved"
  | "changes-requested";

export type ReviewComment = {
  id: string;
  at: number;
  body: string;
  author: string;
  createdAt: string;
  resolved: boolean;
};

export type ReviewItem = {
  version: 1;
  id: string;
  projectId: string;
  clipId: string;
  title: string;
  status: ReviewStatus;
  updatedAt: string;
  comments: ReviewComment[];
};

const STATUSES: ReviewStatus[] = [
  "draft",
  "needs-review",
  "approved",
  "changes-requested",
];

function reviewPath() {
  return path.join(workspaceRoot(), "review-items.json");
}

export function validateComment(input: unknown): ReviewComment {
  const c = input as ReviewComment;
  if (
    !c ||
    typeof c.id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(c.id) ||
    !Number.isFinite(c.at) ||
    c.at < 0 ||
    typeof c.body !== "string" ||
    !c.body.trim() ||
    c.body.length > 500 ||
    typeof c.author !== "string" ||
    !c.author.trim() ||
    c.author.length > 60 ||
    typeof c.resolved !== "boolean"
  )
    throw Error("Invalid review comment");
  return {
    id: c.id,
    at: c.at,
    body: c.body.trim(),
    author: c.author.trim(),
    createdAt: c.createdAt || new Date().toISOString(),
    resolved: c.resolved,
  };
}

export function validateItem(input: unknown): ReviewItem {
  const r = input as ReviewItem;
  if (
    !r ||
    r.version !== 1 ||
    typeof r.id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(r.id) ||
    typeof r.projectId !== "string" ||
    typeof r.clipId !== "string" ||
    typeof r.title !== "string" ||
    !r.title.trim() ||
    r.title.length > 160 ||
    !STATUSES.includes(r.status) ||
    !Array.isArray(r.comments) ||
    r.comments.length > 100
  )
    throw Error("Invalid review item");
  return {
    version: 1,
    id: r.id,
    projectId: r.projectId,
    clipId: r.clipId,
    title: r.title.trim(),
    status: r.status,
    updatedAt: new Date().toISOString(),
    comments: r.comments.map(validateComment),
  };
}

export function emptyReviewItem(
  projectId: string,
  clipId: string,
  title: string,
): ReviewItem {
  return {
    version: 1,
    id: uuid(),
    projectId,
    clipId,
    title: title.slice(0, 160) || "Untitled clip",
    status: "needs-review",
    updatedAt: new Date().toISOString(),
    comments: [],
  };
}

export async function listReviews(): Promise<ReviewItem[]> {
  try {
    const raw = JSON.parse(await fs.readFile(reviewPath(), "utf8"));
    if (!Array.isArray(raw)) return [];
    return raw.map((r) => validateItem(r)).slice(0, 200);
  } catch {
    return [];
  }
}

export async function saveReview(item: ReviewItem) {
  const row = validateItem(item);
  const rows = await listReviews();
  const next = [row, ...rows.filter((r) => r.id !== row.id)].slice(0, 200);
  const tmp = reviewPath() + "." + uuid() + ".tmp";
  try {
    await fs.writeFile(tmp, JSON.stringify(next, null, 2));
    await fs.rename(tmp, reviewPath());
  } finally {
    await fs.rm(tmp, { force: true });
  }
  return row;
}

export function addComment(
  item: ReviewItem,
  body: string,
  at = 0,
  author = "local",
): ReviewItem {
  const comment = validateComment({
    id: uuid(),
    at,
    body,
    author,
    createdAt: new Date().toISOString(),
    resolved: false,
  });
  return validateItem({
    ...item,
    comments: [...item.comments, comment].slice(0, 100),
  });
}
