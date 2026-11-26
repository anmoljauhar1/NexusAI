import { notFound } from "next/navigation";
import { ModuleHeader, Overview, SettingsSurface, UnavailableSurface } from "@/components/module-content";
import { SystemStatus } from "@/components/status";
import { WorkspaceFeature } from "@/components/workspace-feature";
import { WorkflowBlueprint } from "@/components/workflow";
import { modules } from "@/lib/modules";

type Props = { params: Promise<{ module: string }> };

export function generateStaticParams() {
  return modules.map(({ id }) => ({ module: id }));
}

export async function generateMetadata({ params }: Props) {
  const { module } = await params;
  return { title: modules.find((item) => item.id === module)?.name ?? "Page unavailable" };
}

export default async function WorkspacePage({ params }: Props) {
  const { module } = await params;
  const current = modules.find((item) => item.id === module);
  if (!current) notFound();
  if (current.id === "dashboard") return <><Overview /><WorkspaceFeature feature="dashboard" /></>;
  if (current.id === "settings") return <SettingsSurface />;
  if (current.id === "monitoring") return <><ModuleHeader module={current} /><SystemStatus monitor /><section className="panel dependency-notice"><div><h2>Additional telemetry</h2><p>Worker, GPU, model, and queue metrics require a monitoring API.</p></div></section></>;
  if (current.id === "agents" || current.id === "chat" || current.id === "knowledge" || current.id === "analytics" ||
      current.id === "sql" || current.id === "reports" || current.id === "research" || current.id === "verification") {
    return <><ModuleHeader module={current} /><WorkspaceFeature feature={current.id} />
      {current.id === "agents" && <WorkflowBlueprint />}</>;
  }
  return <UnavailableSurface module={current} />;
}
