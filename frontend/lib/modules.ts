export const modules = [
  { id: "dashboard", name: "Overview", group: "Workspace", summary: "See the available services and explore the NexusAI workspace." },
  { id: "chat", name: "AI Assistant", group: "Workspace", summary: "Ask questions with supporting evidence from your workspace.", requires: ["Conversation and history API", "Answer streaming and source lookup"], areas: ["Conversation history", "Assistant", "Source evidence"] },
  { id: "agents", name: "Agent Studio", group: "Workspace", summary: "Inspect the agents designed to research, analyze, verify, and report.", requires: ["Workflow task and execution API", "Live events, approval, and cancellation"], areas: ["Workflow blueprint", "Agent responsibilities"] },
  { id: "knowledge", name: "Knowledge Base", group: "Workspace", summary: "Manage documents and inspect how they are indexed and retrieved.", requires: ["Authorized document upload and storage", "Processing jobs, chunk inspection, and retrieval"], areas: ["Documents", "Indexing", "Retrieval"] },
  { id: "research", name: "Research Center", group: "Research & Data", summary: "Explore source evidence, contradictions, and research findings.", requires: ["Research tasks and evidence API", "Approved provider for optional web research"], areas: ["Research tasks", "Evidence comparison", "Findings"] },
  { id: "sql", name: "SQL Studio", group: "Research & Data", summary: "Review analytical queries and results from authorized data.", requires: ["Authorized schema catalog", "Read-only query validation and execution"], areas: ["Schema browser", "Query workspace", "Results"] },
  { id: "analytics", name: "Analytics Studio", group: "Research & Data", summary: "Investigate datasets, trends, anomalies, and forecasts.", requires: ["Dataset upload and profiling API", "Prediction and anomaly results"], areas: ["Datasets", "Data profiles", "Forecasts"] },
  { id: "machine-learning", name: "Machine Learning", group: "Models", summary: "Review model configurations, evaluations, and approved versions.", requires: ["Training jobs and evaluation API", "Versioned model registry"], areas: ["Training jobs", "Evaluation", "Model registry"] },
  { id: "deep-learning", name: "Deep Learning", group: "Models", summary: "Inspect neural network training, checkpoints, and evaluations.", requires: ["PyTorch training and checkpoint API", "Actual training logs and hardware metrics"], areas: ["Training runs", "Checkpoints", "Evaluation"] },
  { id: "llm-studio", name: "LLM Studio", group: "Models", summary: "Inspect model providers, fine-tuning runs, and approved adapters.", requires: ["Provider and adapter catalog", "Approved fine-tuning and inference APIs"], areas: ["Providers", "Fine-tuning", "Model comparison"] },
  { id: "verification", name: "Verification Center", group: "Operations", summary: "Examine which claims are supported and where evidence is missing.", requires: ["Claims, evidence, and verification results", "Authorized access to original source passages"], areas: ["Claims", "Evidence", "Verification results"] },
  { id: "reports", name: "Reports", group: "Operations", summary: "Review and download reports with traceable evidence.", requires: ["Report list, detail, and generation API", "Authorized artifact downloads"], areas: ["Report library", "Preview", "Downloads"] },
  { id: "experiments", name: "Experiments", group: "Operations", summary: "Compare experiment runs, evaluation metrics, and artifacts.", requires: ["Experiment and run API", "Approved model versions and artifacts"], areas: ["Runs", "Comparison", "Artifacts"] },
  { id: "monitoring", name: "System Monitor", group: "Operations", summary: "Inspect the API and PostgreSQL readiness using live backend checks." },
  { id: "settings", name: "Settings", group: "Operations", summary: "Manage preferences for this browser and review backend-dependent settings." },
] as const;

export type Module = (typeof modules)[number];
export type ModuleId = Module["id"];
export type UnavailableModule = Extract<Module, { requires: readonly string[] }>;
