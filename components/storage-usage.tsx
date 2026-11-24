"use client";
import {useEffect,useState} from "react";
import {HardDrive} from "lucide-react";
export function StorageUsage() {
  const [data, setData] = useState<
      { name: string; bytes: number; count: number }[]
    >([]),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/storage")
      .then(async (r) => {
        if (!r.ok) throw Error();
        setData(await r.json());
      })
      .catch(() =>
        setError("Unable to read storage usage. Reopen Storage to retry."),
      );
  }, []);
  const total = data.reduce((a, d) => a + d.bytes, 0);
  return (
    <>
      <p className="storage-summary">
        <HardDrive size={20} /> {(total / 1024 ** 3).toFixed(2)} GB used by the
        studio
      </p>
      {error && <p role="alert">{error}</p>}
      {data.map((d) => (
        <div className="storage-line" key={d.name}>
          <strong>{d.name}</strong>
          <progress value={d.bytes} max={total || 1} />
          <small>
            {d.count} files · {(d.bytes / 1024 ** 2).toFixed(1)} MB
          </small>
        </div>
      ))}
    </>
  );
}
