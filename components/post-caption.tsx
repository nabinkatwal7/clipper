"use client";
import { useEffect, useState } from "react";
import { Copy, Check, Sparkles, FileDown, LoaderCircle } from "lucide-react";
import type { Clip } from "@/lib/types";
import { postCaption } from "@/lib/post-captions";
export function PostCaption({
  clip,
  project,
  disabled,
  onUpdated,
}: {
  clip: Clip;
  project: string;
  disabled: boolean;
  onUpdated: () => Promise<void>;
}) {
  const saved = postCaption(clip);
  const [draft, setDraft] = useState(saved),
    [working, setWorking] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    setDraft(saved);
    setCopied(false);
    setPending(false);
  }, [saved]);
  async function submit(generate = false) {
    setWorking(true);
    setError("");
    try {
      const response = await fetch("/api/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project,
          clip: clip.id,
          ...(generate ? {} : { caption: draft }),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setPending(response.status === 202);
      await onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(false);
    }
  }
  return (
    <div className="post-caption">
      <div className="post-caption-heading">
        <label htmlFor={`post-caption-${clip.id}`}>Post caption</label>
        <button
          type="button"
          title="Copy post caption"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(draft);
              setCopied(true);
            } catch {
              setError(
                "Copy failed. Select the caption text and copy it manually.",
              );
            }
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}{" "}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <textarea
        id={`post-caption-${clip.id}`}
        value={draft}
        maxLength={2200}
        rows={4}
        onChange={(e) => {
          setDraft(e.target.value);
          setCopied(false);
        }}
        disabled={working || disabled}
      />
      {!clip.postCaption && (
        <p className="post-caption-hint">
          Add your own hook and hashtags, or generate a caption.
        </p>
      )}
      <div className="post-caption-tools">
        <button
          type="button"
          disabled={working || disabled}
          onClick={() => void submit(true)}
        >
          {working ? (
            <LoaderCircle size={13} className="spin" />
          ) : (
            <Sparkles size={13} />
          )}
          Generate caption
        </button>
        {draft !== saved ? (
          <button
            type="button"
            disabled={working || disabled || !draft.trim()}
            onClick={() => void submit()}
          >
            Save caption
          </button>
        ) : (
          <a
            href={`/api/download?project=${project}&clip=${clip.id}&kind=caption`}
          >
            <FileDown size={13} />
            Download TXT
          </a>
        )}
        <span>{draft.length}/2200</span>
      </div>
      {pending && disabled && (
        <p className="post-caption-hint" role="status">
          Caption queued. It will appear here automatically.
        </p>
      )}
      {error && (
        <p role="alert" className="post-caption-error">
          {error}
        </p>
      )}
      <p className="post-caption-hint">
        Your saved caption is included in the clip download.
      </p>
    </div>
  );
}
