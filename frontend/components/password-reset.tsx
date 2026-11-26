"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Brand } from "@/components/brand";
import { workspaceRequest } from "@/lib/workspace";
import { announceSession } from "@/lib/session";

export function PasswordReset({ complete }: { complete: boolean }) {
  const cache = useQueryClient();
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const token = complete ? window.location.hash.slice(1) : "";
    const validToken = /^[A-Za-z0-9_-]{43}$/.test(token);
    if (complete && (!validToken || data.get("password") !== data.get("confirm"))) {
      setError(!validToken ? "Open a valid reset link from your email." : "Passwords do not match.");
      return;
    }
    setError("");
    setWaiting(true);
    try {
      await workspaceRequest(complete ? "auth/reset-password" : "auth/reset-request", {
        method: "POST", body: JSON.stringify(complete ? { token, password: data.get("password") } : { email: data.get("email") }),
      });
      if (complete) {
        window.history.replaceState(null, "", window.location.pathname);
        announceSession(cache, null);
      }
      form.reset();
      setDone(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Password reset failed."); }
    finally { setWaiting(false); }
  }
  return <main className="standalone-layout"><Brand /><section className="panel standalone-message">
    <h1>{complete ? "Choose a new password" : "Reset password"}</h1>
    {done ? <p role="status">{complete ? "Password changed. Sign in again." : "If the account exists, reset instructions will be sent."}</p> :
      <form className="nexus-form" onSubmit={submit}>
        {complete ? <>
          <label>New password<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
          <label>Confirm password<input name="confirm" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
        </> : <label>Email<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>}
        {error && <p role="alert" className="notice">{error}</p>}
        <button className="button primary" disabled={waiting}>{complete ? "Reset password" : "Send reset link"}</button>
      </form>}
    <Link className="button" href="/login">Back to sign in</Link>
  </section></main>;
}
