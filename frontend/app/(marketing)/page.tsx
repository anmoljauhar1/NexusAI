import { BookOpen, BrainCircuit, ChartNoAxesCombined, Database, FileText, Github, Layers3, LockKeyhole, ScanSearch, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeControl } from "@/components/theme";
import { WorkflowBlueprint } from "@/components/workflow";

const features = [
  { href: "/knowledge", title: "Knowledge & retrieval", detail: "Document ingestion, semantic search, and source-level evidence.", icon: BookOpen },
  { href: "/agents", title: "Agent orchestration", detail: "A workflow that connects research, SQL, analysis, and reporting.", icon: Workflow },
  { href: "/analytics", title: "Predictive analytics", detail: "Explore the proposed dataset, forecasting, and model evaluation surfaces.", icon: ChartNoAxesCombined },
  { href: "/verification", title: "Evidence verification", detail: "Trace supported claims, contradictions, and unanswered questions.", icon: ShieldCheck },
] as const;

const faqs = [
  ["What can I use today?", "A configured deployment supports accounts, private workspaces, document search with citations, CSV analysis, and Markdown research reports."],
  ["Does this preview accept private files?", "Document upload requires sign-in and a database-enabled workspace."],
  ["Can the frontend connect to a remote server?", "Yes. Set the server-side backend origin before starting Next.js. System status uses the same three FastAPI endpoints on a local or remote backend."],
];

function repositoryUrl() {
  const value = process.env.NEXT_PUBLIC_NEXUSAI_REPOSITORY_URL;
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.origin === "https://github.com" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function HeroDiagram() {
  return <div className="hero-diagram" aria-hidden="true">
    <div className="hero-orbit orbit-outer" /><div className="hero-orbit orbit-inner" />
    <div className="hero-axis axis-horizontal" /><div className="hero-axis axis-vertical" />
    <div className="hero-core"><Layers3 size={64} strokeWidth={1.2} /></div>
    <span className="orbit-item orbit-top"><ScanSearch size={23} /></span>
    <span className="orbit-item orbit-right"><BrainCircuit size={23} /></span>
    <span className="orbit-item orbit-bottom"><ShieldCheck size={23} /></span>
    <span className="orbit-item orbit-left"><Database size={23} /></span>
  </div>;
}

export default function Landing() {
  const github = repositoryUrl();
  return <div className="marketing">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <header className="marketing-header"><div className="marketing-inner">
      <Brand />
      <nav aria-label="Product"><a href="#platform">Platform</a><a href="#workflow">Workflow</a><a href="#faq">FAQ</a></nav>
      <div className="marketing-actions"><ThemeControl /><Link className="button" href="/login">Sign In</Link></div>
    </div></header>
    <main id="main-content">
      <section className="marketing-hero">
        <div className="marketing-inner hero-inner">
          <div className="hero-copy"><p className="eyebrow"><Sparkles size={15} /> Research & decision intelligence</p>
            <h1>One Platform. Multiple AI Agents. <span>Intelligent Decisions.</span></h1>
            <p>NexusAI is designed to combine autonomous AI agents, advanced retrieval, machine learning, and evidence verification to transform information into actionable intelligence.</p>
            <div className="button-row"><Link className="button primary" href="/dashboard">Get Started</Link><a className="button" href="#workflow">Explore the workflow</a></div>
          </div>
          <HeroDiagram />
        </div>
      </section>
      <section className="marketing-inner marketing-section" id="platform">
        <header className="marketing-section-heading"><p className="eyebrow">The platform</p><h2>From source material to a decision</h2><p>Explore the intended workflow and see which services this preview has connected.</p></header>
        <div className="product-features">{features.map(({ href, title, detail, icon: Icon }) => <Link key={href} href={href} className="capability-card"><span className="tile-icon"><Icon size={23} /></span><h3>{title}</h3><p>{detail}</p></Link>)}</div>
      </section>
      <section className="marketing-inner marketing-section" id="workflow">
        <header className="marketing-section-heading"><p className="eyebrow">Interactive product preview</p><h2>Follow the workflow</h2><p>Select an agent to see its role and dependencies. This is the proposed workflow structure.</p></header>
        <WorkflowBlueprint />
      </section>
      <section className="marketing-inner marketing-section supporting-grid" aria-label="Use cases and architecture">
        <article className="panel"><FileText size={22} /><h2>Where it fits</h2><p>Review evidence across business documents, compare sales trends, and assemble findings that other people can trace and check.</p></article>
        <article className="panel"><Layers3 size={22} /><h2>Architecture</h2><p>Next.js provides the workspace. FastAPI authorizes requests, PostgreSQL stores workspace data, and the optional LangGraph workflow builds research reports.</p></article>
        <article className="panel"><LockKeyhole size={22} /><h2>Security and privacy</h2><p>Workspace actions use a same-origin gateway and an HTTP-only session cookie. FastAPI checks workspace ownership before serving private data.</p></article>
      </section>
      <section className="marketing-inner marketing-section faq-section" id="faq">
        <h2>Frequently asked questions</h2>
        <div>{faqs.map(([question, answer]) => <details className="faq-item" key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
      </section>
    </main>
    <footer className="marketing-footer"><div className="marketing-inner"><Brand /><Link href="/monitoring">System Status</Link>{github && <a href={github} target="_blank" rel="noreferrer"><Github size={18} /> GitHub</a>}</div></footer>
  </div>;
}
