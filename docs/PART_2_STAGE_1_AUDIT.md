# NexusAI Part 2 · Stage 1 audit

25 November 2026. The audit covers the workspace and prior test records. The earlier direction to execute all tests on a server still applies. No test server or test database was identified. This stage made documentation changes only.

## Part 1 status

| Component | Classification | Evidence |
| --- | --- | --- |
| FastAPI foundation, settings, logging, error handling and OpenAPI | Implemented but unverified | Application factory in `backend/app/main.py` and routes in `backend/app/api/status.py`. The source defines `/health`, `/ready`, `/api/v1/status`, and documentation routes. Uvicorn startup and live responses have no recorded results. |
| PostgreSQL connection management | Partially implemented | `backend/app/database/connection.py` contains a lifespan-managed connection pool and `SELECT 1` probe. |
| Live PostgreSQL verification | Blocked | No authorized server and test database URL were identified. The URL is required for the marked integration test. |
| Database schema, Alembic migrations and pgvector | Missing | `docs/DATABASE_SCHEMA.md` describes the proposed design. Source migrations and application models are absent. |
| Registration, login, workspace authorization and isolation | Missing | No authentication routes, workspace models or isolation tests in the workspace. |
| Uploads, ingestion, embeddings and hybrid retrieval | Missing | No document routes, worker, extractors, embedding service or retrieval service. |
| RAG, source citations and conversation history | Missing | The design exists in `docs/ARCHITECTURE.md`. No RAG service, citation resolver or persistence layer. |
| Frontend and API integration | Missing | No frontend project in the workspace. |
| Part 1 evaluation | Missing | No corpus, relevance labels, benchmark runner or measured results. |
| Test suite and project dependencies | Implemented but unverified for the suite and direct pins. Reproducible resolution is pending. | Twelve application tests and one PostgreSQL integration test exist across two source files. Direct pins exist in `pyproject.toml`. Neither a project-local environment nor `uv.lock` is present. Git is installed and the workspace has no Git repository. |

Actual automated results for this audit: **0 runs**. There are no recorded passes, failures or skips. Runtime status and dependency compatibility remain unknown. Read-only source inspection and hardware inventory were completed.

When a test server is available, run the README setup, Ruff, Pytest and loopback Uvicorn smoke checks there. Check liveness with the database unset and readiness against an authorized disposable PostgreSQL test database. Record the OS, Python version, lockfile, results and any failures. Finish Part 1 with separate approval at its Stage 3–9 gates, including the reviewed retrieval benchmark.

## Environment

| Resource | Workspace machine |
| --- | --- |
| OS and CPU | Windows 11 x64 build 29708. Intel Core i5-8265U, four physical cores and eight logical threads. |
| System memory | 7.85 GiB usable. Approximately 0.92 GiB available during this audit. |
| GPU | NVIDIA GeForce MX250, 2 GiB VRAM, driver 516.40. Prior inspection verified a CPU-only PyTorch build. GPU training capability remains unverified. |
| Free disk | 17.3 GiB on C: where the workspace is stored, 57.9 GiB on D:, and 95.4 GiB on E:. |
| Tooling | Python 3.13.1, uv 0.7.20, Node 22.16.0, npm 11.4.2, Git 2.48.1, Docker CLI 28.5.1 and Compose 2.40.0. The Docker configuration was inaccessible. The earlier audit could not reach the engine. |
| Active Python inventory | FastAPI 0.136.1, Pydantic 2.13.2, SQLAlchemy 2.0.49, Uvicorn 0.46.0, LangChain 1.2.17, LangGraph 1.1.10, PyTorch 2.11.0, Transformers 5.7.0, Sentence Transformers 5.4.1, NumPy 2.4.2, scikit-learn 1.8.0, and Matplotlib 3.10.9. The inventory did not list Pandas, XGBoost, Hugging Face Datasets, PEFT, MLflow, Alembic, Psycopg 3, pytest, or Ruff. |
| Server resources | Unknown. SSH is installed on the workspace machine. No test server hostname, session or checkout path was provided. |

These installed versions describe the workspace interpreter. Pin compatible project and server versions when the relevant stage is approved. Keep heavy training dependencies in separate dependency groups or isolated environments. Resolve the lockfiles and check Python, OS and hardware support on the designated server.

## Proposed agent architecture

FastAPI owns authentication, authorization, task creation, approval, cancellation and event delivery. It enqueues work for a separate worker. The worker runs a LangGraph state graph and stores checkpoints in PostgreSQL. Use a task-scoped thread ID, a distinct status and event record, and ownership checks before loading, resuming or streaming a task.

Typed state carries the task, requester and workspace IDs, original request, objective, validated dependency plan, selected agents, node status, tool call and result references, evidence, SQL results, model predictions, verification findings, errors, retry counters, final response, and timestamps. Persist large artifacts as workspace-scoped references. Keep credentials out of state and logs.

| Agent | Responsibilities and dependencies |
| --- | --- |
| Supervisor | Classifies intent, requests clarification for missing inputs, validates dependency order and chooses from registered capabilities. |
| Research | Reuses Part 1 retrieval and citation services. Preserves passage-level evidence and flags contradictions. External research requires an approved provider. |
| SQL | Maps analytical questions to constrained queries over approved workspace-scoped views. Enforces AST validation, parameter binding, a dedicated read-only role, database-enforced row isolation, limits and timeouts. |
| Data Analyst | Uses deterministic Pandas operations and approved trained-model artifacts. Returns calculations and predictions with provenance. |
| Verification | Recomputes numeric claims, checks SQL execution records, citations and model versions, and returns structured findings including uncertainty. |
| Report Writer | Combines evidence and verification findings into structured JSON, Markdown and PDF, with chart downloads and clear disclosure of unresolved claims. |

Route only dependencies that are ready. The same graph handles sequential steps and parallel independent steps, with worker concurrency capped. Put deadlines on tools and workflows, bound retryable failures and execution steps, and check cancellation between steps. Approvals use a checkpointed interrupt tied to the authenticated user and the precise action. Persist side-effect identifiers so a retried or resumed node can check whether it has already completed its operation. Test restart and approval replay before connecting external tools. [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence) · [Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)

## Data and experiments

- **Primary dataset:** UCI Online Retail II, CC BY 4.0, 1,067,371 transaction rows spanning about two years. Use public retail data with attribution and a pinned file checksum. Start with next-day aggregate recorded sales, document how returns and cancellations affect the target, and audit missing values and duplicate candidates. A repeat-purchase classification task is optional if a forward observation window and usable customer IDs support it. Keep customer identifiers out of public reports. [UCI Online Retail II](https://archive.ics.uci.edu/dataset/502/online%2Bretail%2Bii)
- **Small pipeline fixture:** UCI Daily Demand Forecasting Orders, CC BY 4.0, 60 observations. Use it for a quick ingestion and forecasting pipeline check. The short series limits model comparison. Verify each feature would be available at prediction time. [UCI Daily Demand Forecasting Orders](https://archive.ics.uci.edu/dataset/409/daily%2Bdemand%2Bforecasting%2Borders)
- **Classical models:** Compare prior-day and prior-week naive forecasts, linear regression, a bounded random forest and small XGBoost runs on identical time splits. Tune on rolling validation windows and reserve a final chronological test set. Report MAE, RMSE and R² where meaningful. For suitable classification labels, compare logistic regression, random forest and XGBoost with precision, recall, F1 and ROC-AUC where applicable. Compare Isolation Forest with a robust statistical baseline. Report detection accuracy only where reviewed or explicitly synthetic labels exist. [scikit-learn time-series splitting](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html)
- **Deep learning:** Pilot a one-layer PyTorch GRU, starting with a 28-day input window and 16–32 hidden units. Train with early stopping and fit normalization on training observations only. Use the same forecast horizon, feature availability rules and chronological split as the classical comparison. Record duration, train and validation loss, artifacts and held-out metrics. [PyTorch GRU](https://docs.pytorch.org/docs/stable/generated/torch.nn.GRU.html)
- **Fine-tuning:** Evaluate the Apache-2.0 Qwen2.5-0.5B-Instruct base model first. Propose supervised PEFT LoRA with batch size one, gradient accumulation and up to 512 tokens for the pilot. Use original, reviewable instruction examples with evidence grounded in public or original text. Hold out whole source and template groups, and test structured response validity, instruction following, evidence support, unsupported claims and latency. Consider QLoRA only after verifying the server accelerator and quantization stack. Save an adapter, exact base revision, dataset version, config, training logs and benchmark results. [Qwen model card](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct) · [PEFT LoRA](https://huggingface.co/docs/peft/en/developer_guides/lora) · [PEFT quantization](https://huggingface.co/docs/peft/en/developer_guides/quantization)

## Resource and cost estimates

The following are planning estimates. Actual server throughput, memory and costs have not been measured.

| Workload | Starting server budget |
| --- | --- |
| Part 1 runtime verification | 4 vCPUs, 8 GiB RAM, and 15–25 GiB free disk for the app and dependencies. Plan more RAM if running local generation alongside PostgreSQL and ingestion. |
| Classical ML and GRU pilots | 4 vCPUs, 8–16 GiB RAM, and 10–20 GiB free disk for data, caches and artifacts. Run one job at a time. Allow minutes for aggregate CPU pilots and measure the first run before scheduling a tuning sweep. |
| 0.5B LoRA pilot | A planning target of 8 GiB compatible GPU VRAM, 16 GiB host RAM, and 15–25 GiB free disk. Measure peak memory and tokens per second in a short dry run before budgeting a full run. The laptop's 2 GiB MX250 and current headroom are unsuitable for the proposed pilot. |

Public datasets and the local software stack require no license purchase for the proposed use. Expected costs on an existing authorized server are compute, storage and downloads. An external provider would add usage charges and data-handling considerations. A paid GPU or API is outside the approved work. A Stage 9 run is blocked until the operator, hardware and experiment are approved.

## Stage plan and acceptance gates

| Stage | Work and acceptance |
| --- | --- |
| 1 · Audit | Source audit, environment and plan recorded. Runtime and test verification remain blocked until a server is identified. |
| 2 · Orchestration | Define six node contracts, typed state, worker execution and checkpointing. Verify sequential and parallel routing, approved resume, idempotent recovery, cancellation, retry bounds and timeouts on the server. |
| 3 · Supervisor | Validate plans from representative requests for every intent. Reject unregistered tools and invalid dependencies. Test clarification and failed-node handling. |
| 4 · Research | Integrate verified Part 1 retrieval. Demonstrate rewritten queries, multi-document evidence, contradictions and traceable citations against reviewed examples. Enable external search only after approval. |
| 5 · SQL | Add approved views and a limited database role. Test correct aggregate results and rejection of unauthorized data access, writes and out-of-workspace queries against PostgreSQL. |
| 6 · Classical ML | Document sources, checksums, preprocessing and split dates. Train and save real baseline and candidate metrics and inference artifacts. |
| 7 · Deep learning | Train a bounded GRU pilot and publish its metrics and resource usage against the same baseline and test protocol. |
| 8 · Analyst | Run actual descriptive analysis, charts, anomalies and forecasts from the trained artifacts. Check numerical results against direct tool calls. |
| 9 · Fine-tuning | Obtain approval for configuration, data and resources. Compare the base and adapter on held-out examples, or record the resource blocker. |
| 10 · Verification | Check calculations, SQL outputs, citations and prediction lineage. Compare structured verdicts with manually reviewed examples. |
| 11 · Reports | Generate Markdown, JSON, PDF and charts from real verified findings. Confirm citations resolve and uncertainty survives export. |
| 12 · MLflow | Track runs and versioned artifacts. Verify an approved artifact can be selected and an unapproved version cannot be promoted automatically. |
| 13 · API | Integrate authenticated task, approval, cancellation, event streaming, model and report routes. Verify isolation, responsiveness and real worker status. |
| 14 · Frontend | Extend the verified Part 1 frontend. Demonstrate agent, analytics, model, research and report screens with live API responses. |
| 15 · Evaluation | Review at least 20 expected outcomes before comparing direct LLM, RAG, single-agent, multi-agent and verified multi-agent variants. Record task and SQL correctness, citation and verification scores, unsupported claims, failure rate, latency, token usage and actual cost where available. |

Pause at each stage boundary. Part 2 Stage 2 is awaiting approval. The recommended next implementation is Part 1 Stage 3 after verifying its backend on the designated server, because the later research, access control and frontend workflows depend on unfinished Part 1 services. External search and large model downloads or training have their own approval gates.
