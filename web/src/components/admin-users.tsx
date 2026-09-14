"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AppUser, UserStatus } from "@/db/schema";
import { useViewer } from "@/hooks/use-viewer";
import { ChevronLeftIcon } from "./icons";

// The owner's list of everyone who has signed in with Google, newest requests
// first, with the one decision that matters: may they see the postings.

const GROUPS: { status: UserStatus; title: string; empty: string }[] = [
  { status: "pending", title: "Waiting for you", empty: "No one is waiting." },
  { status: "approved", title: "Has access", empty: "No one has access yet." },
  { status: "blocked", title: "Blocked", empty: "No one is blocked." },
];

const ACTION =
  "h-7 px-2.5 rounded-md border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

function when(iso: string | Date): string {
  const d = new Date(iso);
  const minutes = Math.round((Date.now() - d.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function AdminUsers() {
  const viewer = useViewer();
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const body = await res.json();
      if (!body.success) throw new Error(body.error);
      setUsers(body.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the list.");
    }
  }, []);

  useEffect(() => {
    if (!viewer.isAdmin) return;
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, [viewer.isAdmin, load]);

  const act = async (email: string, method: "PATCH" | "DELETE", status?: UserStatus) => {
    setBusyEmail(email);
    try {
      const res = await fetch("/api/admin/users", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(status ? { email, status } : { email }),
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through.");
    } finally {
      setBusyEmail(null);
    }
  };

  if (viewer.loading) return <Frame><p className="text-[13px] text-stone">Loading…</p></Frame>;
  if (!viewer.isAdmin) {
    return (
      <Frame>
        <p className="text-[13px] text-slate">Only the site owner can manage access.</p>
      </Frame>
    );
  }

  return (
    <Frame>
      {error && <p className="text-[13px] text-poor bg-error/10 px-3 py-2 rounded-lg">{error}</p>}
      {!users ? (
        <p className="text-[13px] text-stone">Loading…</p>
      ) : (
        GROUPS.map((group) => {
          const rows = users.filter((u) => u.status === group.status);
          return (
            <section key={group.status} className="space-y-2">
              <h2 className="text-[12.5px] font-semibold text-charcoal">
                {group.title} <span className="text-stone font-normal tabular-nums">{rows.length}</span>
              </h2>
              {rows.length === 0 ? (
                <p className="text-[12.5px] text-stone px-1">{group.empty}</p>
              ) : (
                <ul className="rounded-lg border border-hairline bg-canvas divide-y divide-hairline-soft">
                  {rows.map((user) => (
                    <UserRow
                      key={user.email}
                      user={user}
                      isYou={user.email === viewer.email}
                      busy={busyEmail === user.email}
                      onAct={act}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
    </Frame>
  );
}

function UserRow({
  user,
  isYou,
  busy,
  onAct,
}: {
  user: AppUser;
  isYou: boolean;
  busy: boolean;
  onAct: (email: string, method: "PATCH" | "DELETE", status?: UserStatus) => void;
}) {
  const initial = (user.name || user.email).trim().charAt(0).toUpperCase();
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
      <span className="w-8 h-8 shrink-0 rounded-full bg-primary-tint text-primary-deep grid place-items-center text-[13px] font-semibold">
        {initial}
      </span>
      <div className="flex-1 min-w-[180px]">
        <p className="text-[13px] font-medium text-ink truncate">
          {user.name || user.email}
          {isYou && <span className="ml-1.5 text-[11.5px] font-normal text-stone">you</span>}
        </p>
        <p className="text-[12px] text-steel truncate">
          {user.email} · first signed in {when(user.createdAt)} · last seen {when(user.lastSeenAt)}
        </p>
      </div>
      {!isYou && (
        <div className="flex gap-1.5">
          {user.status !== "approved" && (
            <button
              onClick={() => onAct(user.email, "PATCH", "approved")}
              disabled={busy}
              className={`${ACTION} border-primary bg-primary text-on-primary hover:bg-primary-pressed`}
            >
              Approve
            </button>
          )}
          {user.status !== "blocked" && (
            <button
              onClick={() => onAct(user.email, "PATCH", "blocked")}
              disabled={busy}
              className={`${ACTION} border-hairline text-poor hover:bg-error/5`}
            >
              {user.status === "approved" ? "Remove access" : "Block"}
            </button>
          )}
          {user.status === "blocked" && (
            <button
              onClick={() => onAct(user.email, "DELETE")}
              disabled={busy}
              title="Forget them; signing in again makes a new request"
              className={`${ACTION} border-hairline text-charcoal hover:bg-surface`}
            >
              Forget
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 bg-surface">
      <div className="max-w-[760px] mx-auto px-4 sm:px-6 py-8 space-y-6">
        <header className="space-y-1.5">
          <Link href="/" className="inline-flex items-center gap-1 text-[12.5px] text-steel hover:text-charcoal">
            <ChevronLeftIcon className="w-3.5 h-3.5" />
            Postings
          </Link>
          <h1 className="text-[22px] font-semibold text-ink">Access</h1>
          <p className="text-[13px] text-slate max-w-[60ch]">
            Everyone who has signed in with Google. A new sign-in waits here, seeing nothing, until you approve it; you
            get an ntfy notification when one arrives.
          </p>
        </header>
        {children}
      </div>
    </main>
  );
}
