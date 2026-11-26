import Link from "next/link";
import { Orbit } from "lucide-react";

export function Brand() {
  return <Link className="brand" href="/" aria-label="NexusAI home">
    <span className="brand-symbol"><Orbit size={22} aria-hidden="true" /></span>
    <span>Nexus<span>AI</span></span>
  </Link>;
}
