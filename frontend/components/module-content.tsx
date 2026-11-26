import { Blocks, BookOpen, Database, FileText, MessageSquare, ShieldCheck, Workflow } from "lucide-react";
import Link from "next/link";
import { icons } from "@/components/module-icons";
import { SystemStatus } from "@/components/status";
import { ThemeControl } from "@/components/theme";
import { WorkflowBlueprint } from "@/components/workflow";
import { modules, type Module, type UnavailableModule } from "@/lib/modules";

export function ModuleHeader({ module }: { module: Module }) {
  const Icon = icons[module.id];
  return <header className="module-header"><div className="tile-icon"><Icon size={21} /></div>
    <div><h1>{module.name}</h1><p>{module.summary}</p></div>
  </header>;
}

const overviewLinks = ["chat", "agents", "knowledge", "monitoring"] as const;

export function Overview() {
  return <>
    <section className="overview-hero">
      <div><p className="eyebrow"><span /> NexusAI Workspace</p><h1>Research and decisions,<br />in one workspace.</h1>
        <p>Manage your private workspaces, explore your documents and check connected services.</p>
        <Link href="/agents" className="button primary"><Workflow size={17} /> Explore Agent Studio</Link>
      </div>
      <div className="overview-art" aria-hidden="true"><span /><span /><span /><Workflow size={72} strokeWidth={1} /></div>
    </section>
    <SystemStatus />
    <section aria-labelledby="explore-title"><h2 id="explore-title" className="section-heading">Explore the workspace</h2>
      <div className="capability-grid">{overviewLinks.map((id) => {
        const module = modules.find((item) => item.id === id)!;
        const Icon = icons[id];
        return <Link className="capability-card" key={id} href={`/${id}`}><span className="tile-icon"><Icon size={19} /></span><h3>{module.name}</h3><p>{module.summary}</p></Link>;
      })}</div>
    </section>
  </>;
}

function DependencyNotice({ module }: { module: UnavailableModule }) {
  return <section className="panel dependency-notice" aria-label="Backend prerequisites">
    <Blocks size={22} aria-hidden="true" />
    <div><h2>Backend integration unavailable</h2><p>This module needs the following services.</p><ul>{module.requires.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul></div>
  </section>;
}

export function UnavailableSurface({ module }: { module: UnavailableModule }) {
  return <>
    <ModuleHeader module={module} />
    {module.id === "agents" && <WorkflowBlueprint />}
    {module.id === "chat" && <div className="chat-layout">
      <section className="panel chat-side"><MessageSquare size={19} /><h2>History</h2><p>Conversation history is unavailable.</p></section>
      <section className="panel chat-center"><span className="tile-icon"><MessageSquare size={25} /></span><h2>AI Assistant</h2><p>Chat is unavailable until the answer and conversation services are connected.</p><Link className="button" href="/knowledge"><BookOpen size={17} /> Knowledge Base</Link></section>
      <section className="panel chat-side"><FileText size={19} /><h2>Evidence</h2><p>Supporting passages will appear when an answer includes citations.</p></section>
    </div>}
    <DependencyNotice module={module} />
    {module.id !== "chat" && module.id !== "agents" && <section className="surface-grid" aria-label={`${module.name} sections`}>
      {module.areas.map((area, index) => {
        const Icon = [icons[module.id], Database, FileText][index];
        return <article className="panel unavailable-card" key={area}><span className="tile-icon"><Icon size={19} /></span><h2>{area}</h2><p>Awaiting backend data.</p></article>;
      })}
    </section>}
  </>;
}

export function SettingsSurface() {
  return <>
    <ModuleHeader module={modules[14]} />
    <section className="panel settings-panel"><div><h2>Appearance</h2><p>Theme preferences are saved in this browser.</p></div><ThemeControl expanded /></section>
    <section className="panel settings-panel"><div><h2>Workspace and account</h2><p>View your account email, account ID, and sign-out options.</p></div><Link className="button" href="/profile"><ShieldCheck size={17} /> My profile</Link></section>
    <section className="panel settings-panel"><div><h2>Backend connection</h2><p>The backend address is managed by the server configuration.</p></div><Link className="button" href="/monitoring">View System Monitor</Link></section>
  </>;
}
