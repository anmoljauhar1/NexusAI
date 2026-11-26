"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Brand } from "@/components/brand";
import { announceSession, useSession } from "@/lib/session";
import { account, post, workspaceRequest } from "@/lib/workspace";

export function AccountPage({ action }: { action: "login" | "register" | "logout" }) {
  const router = useRouter();
  const cache = useQueryClient();
  const session = useSession();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [failure, setFailure] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailure("");
    const form = event.currentTarget;
    try {
      if (action === "logout") {
        await workspaceRequest("auth/logout", { method: "POST" });
        announceSession(cache, null);
      } else {
        const fields = new FormData(form);
        const current = await post(`auth/${action}`, {
          email: String(fields.get("email")).trim(), password: fields.get("password"),
        }, account);
        announceSession(cache, current);
      }
      form.reset();
      router.replace(action === "logout" ? "/login" : "/dashboard");
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "The account request failed.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const title = { login: "Sign in", register: "Create an account", logout: "Sign out" }[action];
  const alreadySignedIn = action !== "logout" && !!session.data && !session.isError;
  return <main className="standalone-layout"><Brand /><section className="panel standalone-message">
    <span className="tile-icon"><ShieldCheck size={23} /></span><h1>{title}</h1>
    {alreadySignedIn ? <>
      <p>Signed in as <strong>{session.data?.email}</strong>.</p>
      <div className="button-row"><Link className="button primary" href="/profile">View profile</Link>
        <Link className="button" href="/logout">Sign out</Link></div>
    </> : <form className="nexus-form" onSubmit={submit}>
      {action !== "logout" && <>
        <label>Email<input type="email" name="email" required maxLength={254} autoComplete="email" /></label>
        <div className="password-field"><label>Password<input type={visible ? "text" : "password"} name="password" required maxLength={128}
          minLength={action === "register" ? 12 : undefined} autoComplete={action === "register" ? "new-password" : "current-password"} /></label>
          <button className="icon-button" type="button" aria-label={visible ? "Hide password" : "Show password"}
            onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button>
        </div>
        {action === "register" && <p>Use at least 12 characters.</p>}
      </>}
      {action === "logout" && <p>{session.data?.email ? `Sign out of ${session.data.email} on this browser?` : "End this browser session."}</p>}
      {action === "login" && <Link href="/forgot-password">Forgot password?</Link>}
      {failure && <p className="notice" role="alert">{failure}</p>}
      <div className="button-row">
        <button className="button primary" disabled={busy}>{busy ? "Please wait…" : title}</button>
        <Link href={action === "login" ? "/register" : action === "register" ? "/login" : "/dashboard"} className="button">
          {action === "login" ? "Create account" : action === "register" ? "Sign in" : "Cancel"}
        </Link>
      </div>
    </form>}
  </section></main>;
}
