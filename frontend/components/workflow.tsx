"use client";

import { BrainCircuit, Database, FileText, GitBranch, ScanSearch, ShieldCheck, Workflow } from "lucide-react";
import { useState } from "react";

const agents = [
  { name: "Supervisor", icon: Workflow, description: "Plans a task, identifies dependencies, and routes work to registered tools.", dependency: "Receives a task from an authorized workspace." },
  { name: "Research", icon: ScanSearch, description: "Collects relevant passages and retains their document and source references.", dependency: "Runs after the Supervisor approves the research step." },
  { name: "SQL", icon: Database, description: "Prepares read-only analytical queries against authorized schemas.", dependency: "Runs after the Supervisor defines an analytical objective." },
  { name: "Data Analyst", icon: BrainCircuit, description: "Uses deterministic analysis and approved trained models for numerical results.", dependency: "Runs after a dataset and analysis objective are identified." },
  { name: "Verification", icon: ShieldCheck, description: "Checks cited passages, calculations, execution records, and model provenance.", dependency: "Runs once the independent findings are available." },
  { name: "Report Writer", icon: FileText, description: "Combines findings and verification decisions into a traceable report.", dependency: "Runs after verification and keeps unresolved findings visible." },
] as const;

export function WorkflowBlueprint() {
  const [selected, setSelected] = useState(0);
  const agent = agents[selected];
  function node(index: number) {
    const { name, icon: Icon } = agents[index];
    return <button key={name} type="button" aria-pressed={selected === index} className="graph-node" onClick={() => setSelected(index)}>
      <Icon size={18} aria-hidden="true" />{name}
    </button>;
  }
  return <div className="graph-layout">
    <section className="graph-canvas" aria-label="Planned agent dependencies">
      <span className="graph-caption"><GitBranch size={15} /> Workflow blueprint</span>
      <div className="graph-chain">
        <div className="graph-row">{node(0)}</div>
        <span className="graph-edge" aria-hidden="true" />
        <div className="graph-row branches">{[1, 2, 3].map(node)}</div>
        <span className="graph-edge" aria-hidden="true" />
        <div className="graph-row">{node(4)}</div>
        <span className="graph-edge" aria-hidden="true" />
        <div className="graph-row">{node(5)}</div>
      </div>
    </section>
    <section className="graph-details" aria-label="Selected agent" aria-live="polite">
      <div className="tile-icon"><agent.icon size={21} /></div>
      <h3>{agent.name}</h3><p>{agent.description}</p>
      <dl><dt>Dependency</dt><dd>{agent.dependency}</dd><dt>Execution</dt><dd>This diagram shows the proposed six-agent design. The current research workflow runs Research, Verification and Report Writer steps.</dd></dl>
    </section>
  </div>;
}
