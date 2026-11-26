import Link from "next/link";
import { Brand } from "@/components/brand";

export default function NotFound() {
  return <main className="standalone-layout"><Brand /><section className="panel standalone-message"><h1>Page unavailable</h1><p>This address does not match a NexusAI page.</p><Link className="button primary" href="/dashboard">Open workspace</Link></section></main>;
}
