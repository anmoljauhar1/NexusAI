"use client";

import { Copy, LogOut, UserRound } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { announceSession, sessionKey, useSession } from "@/lib/session";
import { account, get, post, workspaceRequest, type Account } from "@/lib/workspace";

export function AccountMenu() {
  const session = useSession();
  if (session.isPending) return <span className="icon-button profile-link" aria-label="Checking account"><UserRound size={17} /></span>;
  if (!session.data || session.isError) {
    return <Link className="icon-button profile-link" href={session.isError ? "/profile" : "/login"}
      aria-label={session.isError ? "Account status" : "Sign in"} title={session.isError ? "Account status" : "Sign in"}><UserRound size={17} /></Link>;
  }
  return <details className="notifications account-menu">
    <summary className="icon-button profile-link" aria-label="Account menu" title="Account menu"><UserRound size={17} /></summary>
    <div className="notification-panel">
      <strong>{session.data.display_name || "Signed in"}</strong><p className="account-email">{session.data.email}</p>
      <nav aria-label="Account"><Link href="/profile">My profile</Link><Link href="/logout">Sign out</Link></nav>
    </div>
  </details>;
}

function ProfileSettings({ current }: { current: Account }) {
  const cache = useQueryClient();
  const [passwordError, setPasswordError] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const sessions = useQuery({
    queryKey: ["private", "sessions", current.id],
    queryFn: ({ signal }) => get("auth/sessions", z.array(z.object({
      id: z.uuid(), current: z.boolean(), created_at: z.string(), expires_at: z.string(),
    })), signal),
  });
  const name = useMutation({
    mutationFn: (display_name: string) => post("auth/profile", { display_name }, account),
    onSuccess: (updated) => { cache.setQueryData(sessionKey, updated); setNotice("Display name saved."); },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => workspaceRequest(`auth/sessions/${id}/revoke`, { method: "POST" }),
    onSuccess: () => { void sessions.refetch(); setNotice("Session revoked."); },
  });
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (data.get("new_password") !== data.get("confirm")) {
      setPasswordError("The new passwords do not match.");
      return;
    }
    setPasswordBusy(true);
    setPasswordError("");
    try {
      const updated = await post("auth/password", {
        current_password: data.get("current_password"), new_password: data.get("new_password"),
      }, account);
      announceSession(cache, updated);
      form.reset();
      setNotice("Password updated. Other sessions were revoked.");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Password could not be changed.");
    } finally { setPasswordBusy(false); }
  }
  const failure = name.error ?? revoke.error ?? sessions.error;
  return <>
    <form className="nexus-form" onSubmit={(event) => {
      event.preventDefault();
      name.mutate(String(new FormData(event.currentTarget).get("display_name")));
    }}>
      <label>Display name<input name="display_name" maxLength={80} defaultValue={current.display_name ?? ""} /></label>
      <button className="button" disabled={name.isPending}>Save profile</button>
    </form>
    <form className="nexus-form" onSubmit={changePassword}>
      <h2>Change password</h2>
      <label>Current password<input type="password" name="current_password" autoComplete="current-password" required maxLength={128} /></label>
      <label>New password<input type="password" name="new_password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
      <label>Confirm new password<input type="password" name="confirm" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
      {passwordError && <p role="alert" className="notice">{passwordError}</p>}
      <button className="button" disabled={passwordBusy}>Change password</button>
    </form>
    <section><h2>Active sessions</h2>
      {sessions.isPending && <p role="status">Loading sessions…</p>}
      <ul className="feature-list">{sessions.data?.map((session) => <li key={session.id}>
        <strong>{session.current ? "This browser" : "Other session"}</strong>
        <p className="metadata">Started {new Date(session.created_at).toLocaleString()} · Expires {new Date(session.expires_at).toLocaleString()}</p>
        {!session.current && <button className="button" disabled={revoke.isPending} onClick={() => revoke.mutate(session.id)}>Revoke session</button>}
      </li>)}</ul>
    </section>
    {failure && <p role="alert" className="notice">{failure.message}</p>}
    <p role="status">{notice}</p>
  </>;
}

export function Profile() {
  const session = useSession();
  const [notice, setNotice] = useState("");
  const current = session.isError ? null : session.data;
  async function copyId() {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.id);
      setNotice("Account ID copied.");
    } catch { setNotice("Clipboard is unavailable. Select the account ID to copy it."); }
  }
  return <section className="panel feature-panel">
    <h1>My profile</h1>
    {session.isPending && <p role="status">Checking session…</p>}
    {session.isError && <><p className="notice" role="alert">{session.error.message}</p><button className="button" onClick={() => void session.refetch()}>Retry</button></>}
    {!session.isPending && !session.isError && !current && <><p>Sign in to view your profile.</p><Link className="button primary" href="/login">Sign in</Link></>}
    {current && <><dl className="profile-details">
      <div><dt>Email</dt><dd>{current.email}</dd></div>
      <div><dt>Account ID</dt><dd><code>{current.id}</code><button className="button" onClick={() => void copyId()}><Copy size={16} /> Copy ID</button></dd></div>
    </dl>
      <p role="status">{notice}</p>
      <div className="button-row"><Link href="/dashboard" className="button primary">Open workspaces</Link><Link href="/logout" className="button"><LogOut size={16} /> Sign out</Link></div>
      <ProfileSettings key={current.id} current={current} />
    </>}
  </section>;
}
