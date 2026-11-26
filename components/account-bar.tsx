"use client";
import { useEffect, useState } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { LogOut, Settings, UserRound } from "lucide-react";
import { Button } from "./ui/button";

export function AccountBar({ name, role }: { name: string; role: string }) {
  const [legacy, setLegacy] = useState<{
    available: boolean;
    projects: number;
    files: number;
  } | null>(null);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (role !== "owner") return;
    fetch("/api/legacy")
      .then((r) => r.json())
      .then((s) => s.available && setLegacy(s))
      .catch(() => {});
  }, [role]);
  async function claim() {
    if (
      !confirm(
        `Move ${legacy?.projects} existing project(s) (${legacy?.files} files) into your account? A metadata backup is made first and no media is deleted.`,
      )
    )
      return;
    setNote("Claiming…");
    const r = await fetch("/api/legacy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "claim" }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) location.reload();
    else setNote(j.error || "Claim failed.");
  }
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="account-trigger"
          aria-label="Account menu"
        >
          <UserRound size={16} />
        </Button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          className="studio-account-menu"
          sideOffset={8}
          align="end"
        >
          <Menu.Label>
            <strong>{name}</strong>
            <small>{role}</small>
          </Menu.Label>
          <Menu.Separator />
          <Menu.Item asChild>
            <a href="/app/account">
              <Settings size={15} /> Account settings
            </a>
          </Menu.Item>
          {legacy && (
            <Menu.Item
              onSelect={(event) => {
                event.preventDefault();
                void claim().catch((error) =>
                  setNote(
                    error instanceof Error ? error.message : "Claim failed.",
                  ),
                );
              }}
            >
              Claim {legacy.projects} existing{" "}
              {legacy.projects === 1 ? "project" : "projects"}
            </Menu.Item>
          )}
          {note && <p role="status">{note}</p>}
          <Menu.Item
            onSelect={async (event) => {
              event.preventDefault();
              try {
                const response = await fetch("/api/auth/logout", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: "{}",
                });
                if (!response.ok) throw Error("Could not sign out.");
                location.assign("/login");
              } catch {
                setNote("Could not sign out. Try again.");
              }
            }}
          >
            <LogOut size={15} /> Sign out
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
