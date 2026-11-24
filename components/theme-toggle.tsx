"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => setLight(document.documentElement.dataset.theme === "light"), []);
  function toggle() {
    const next = light ? "dark" : "light";
    setLight(!light);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("site-theme", next); } catch {}
  }
  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={light ? "Switch to dark theme" : "Switch to light theme"} title={light ? "Dark theme" : "Light theme"}>
      {light ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}
