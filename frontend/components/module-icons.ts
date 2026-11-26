import {
  Activity, BookOpen, BrainCircuit, ChartNoAxesCombined, Database, FileText,
  FlaskConical, LayoutDashboard, MessageSquare, Network, ScanSearch, Settings2, ShieldCheck, Sparkles, Workflow,
} from "lucide-react";
import type { ModuleId } from "@/lib/modules";

export const icons = {
  dashboard: LayoutDashboard,
  chat: MessageSquare,
  agents: Workflow,
  knowledge: BookOpen,
  research: ScanSearch,
  sql: Database,
  analytics: ChartNoAxesCombined,
  "machine-learning": BrainCircuit,
  "deep-learning": Network,
  "llm-studio": Sparkles,
  verification: ShieldCheck,
  reports: FileText,
  experiments: FlaskConical,
  monitoring: Activity,
  settings: Settings2,
} satisfies Record<ModuleId, typeof Activity>;
