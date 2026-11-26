"use client";

import Link from "next/link";

export default function WorkspaceError({ reset }: { reset: () => void }) {
  return <section className="panel standalone-message" role="alert">
    <h1>Unable to load this page</h1><p>Reload the module or return to the workspace overview.</p>
    <div className="button-row"><button className="button primary" onClick={reset}>Try again</button><Link className="button" href="/dashboard">Overview</Link></div>
  </section>;
}
