# NexusAI development log

## 25 November 2026 · Stage 1

The workspace was empty before this documentation was added. Git 2.48.1 is installed and the workspace had no repository. This stage created `docs/ARCHITECTURE.md` and this log.

- Windows 11 x64 reported by Python, build 29708.1003. The registry's product name reported Windows 10 Home Single Language and its release label reported Dev.
- Intel Core i5-8265U, 4 cores and 8 logical processors. About 7.85 GiB of usable RAM, with 0.79–0.86 GiB available during two samples.
- NVIDIA GeForce MX250, 2,048 MiB VRAM, driver 516.40. The installed PyTorch is the CPU-only 2.11.0 build. A small CPU tensor calculation succeeded.
- Free storage was 17.3 GiB on C:, 57.9 GiB on D: and 95.4 GiB on E:. The project is on C: under OneDrive.
- Python 3.13.1 works. The launcher lists a Microsoft Store Python 3.11 install whose executable returned access denied. Node 22.16.0, npm 11.4.2 and uv 0.7.20 work.
- The active Python has FastAPI 0.136.1, Pydantic 2.13.2, SQLAlchemy 2.0.49, Uvicorn 0.46.0, Transformers 5.7.0, Sentence Transformers 5.4.1, and LangChain 1.2.17. `pip check` reported no broken requirements. Alembic, Psycopg 3, pgvector, pytest, Ruff, pwdlib, argon2-cffi, pypdf and python-docx were absent from that Python.
- Docker 28.5.1 and Compose 2.40.0 are installed. The daemon pipe was unavailable, the Docker config was inaccessible and WSL enumeration was denied. PostgreSQL and Ollama were not found on PATH and loopback TCP checks on 5432 and 11434 returned false. The Python Ollama client is installed.
- Inspection used `Get-ChildItem`, `git status`, `py -0p`, `python -m pip list/show/check`, `nvidia-smi`, Python `psutil` and `torch` probes, Windows registry and drive APIs, `docker info`, `wsl --list --verbose` and `Test-NetConnection`. CIM queries were denied, so alternate APIs supplied the measurements. One redundant Python probe failed on shell quoting and was replaced with direct `pip show` checks.
- No application tests or benchmarks exist yet. No services were changed, dependencies installed or models downloaded.

## Implementation gates

1. **Stage 1, plan.** Environment findings, architecture, schema and stage gates documented. Wait for approval.
2. **Stage 2, backend foundation.** Use a project-local environment, lock dependencies, implement configuration, structured logs, request validation, central error handling, database lifecycle and OpenAPI. Start Uvicorn and verify `/health`, `/api/v1/status`, API documentation, error responses, liveness and database-unavailable readiness behavior. Run Ruff and Pytest.
3. **Stage 3, data and authentication.** Verify PostgreSQL and pgvector connectivity before migration tests. Apply migrations to a fresh database, test registration, login, token expiry and server-side workspace authorization with two users. Add cross-workspace regression checks alongside each new resource.
4. **Stage 4, ingestion.** Test one representative file per supported format, duplicate uploads, no-readable-text failures, source locators, bounded validation, failure recovery and worker retry. Confirm partial output stays hidden.
5. **Stage 5, embeddings.** Test 384-dimensional outputs from the real model, complete indexing, deterministic retry without duplicates and workspace-filtered cosine results with real source text.
6. **Stage 6, retrieval.** Execute keyword, vector, RRF and reranked searches with the same fixture. Confirm score semantics, stable ranks, filters, response evidence and method-level timings.
7. **Stage 7, RAG.** Test retrieval and generation independently, then verify actual provider answers, citation resolution, conversation persistence, unsupported answers, document-based prompt injection and validated streaming where supported.
8. **Stage 8, frontend.** Run Next.js and the backend together. Verify landing, login, registration, dashboard, documents, knowledge base, chat, history, evaluation and settings. Check responsive layout, themes, sidebar, uploads and processing status, clickable evidence and loading/error states against live APIs.
9. **Stage 9, evaluation.** Prepare 10–30 chunks and 10–15 questions with proposed labels covering exact matches, paraphrases, semantic matches, distractors, insufficient evidence and isolation. Obtain label approval before benchmarking. Report Precision@K, Recall@K, MRR, nDCG@K, latency, faithfulness, citation correctness and unsupported-answer handling. Record configurations and distinguish human judgments from automated checks.

Pause for approval after each stage. Maintain the README, API documentation, database schema, test report and known issues as their corresponding components are introduced.

## Stage 2 · Backend foundation authored

The user directed that code be written in the workspace and all testing take place on a server. Work added the FastAPI application factory, validated environment settings, liveness and readiness probes, versioned service status, centralized errors, JSON application logs, a lifespan-managed PostgreSQL pool, and OpenAPI documentation. Tests live in `backend/tests`. Dependency pins and tool configuration live in `pyproject.toml`.

The workspace inspection and source edits took place locally. Server startup, linting, tests, and dependency resolution are pending. The test report records their status, and the README contains the commands to run on a designated server. Stage 3 has a separate approval gate.

## 25 November 2026 · Part 2 Stage 1 audit

Reviewed the workspace, Part 1 documentation, configuration, source endpoints and the two test files. Repeated the hardware and installed-package inventory. Added [the Part 2 audit and plan](PART_2_STAGE_1_AUDIT.md) and recorded the runtime verification status in the test report. The audit found a Stage 2 backend foundation and missing Part 1 Stages 3–9. No server was identified for the required test execution. Part 2 implementation and model training have not started.

## 25 November 2026 · Part 3 Stage 1 audit

Rechecked the source, existing documentation, test inventory, hardware and deployment tools. Docker's engine was unreachable, and a read-only search found no NexusAI repository in the connected GitHub installations. Added the [production readiness audit](PART_3_STAGE_1_AUDIT.md) with the verification matrix, security observations, AWS estimates and stage gates. Updated the test report. This stage changed documentation only.

## Backend startup follow-up

The base URL now redirects to Swagger or to the status endpoint when Swagger is disabled. Added regression tests and updated the README for the existing lockfile, remote access and common startup failures. The user reconfirmed server-only testing. Runtime verification remains pending.

## Frontend workspace

Added the Next.js workspace, app shell, routes, themes, agent blueprint and typed system-check integration. The account and feature surfaces expose backend requirements and avoid fake operations. [Frontend implementation and integration matrix](FRONTEND_INTEGRATION.md)

## Unified startup and repair

Added a Windows launcher with port checks, setup and launcher-owned shutdown. Added Compose packaging for the implemented services and propagated cancellation through the frontend gateway. Rebuilt the frontend, compared the gateway with the live OpenAPI paths, and checked startup and shutdown on isolated ports. PostgreSQL and advanced application services remain unavailable. [End-to-end report](END_TO_END_TEST_REPORT.md)

## Private workspaces and decision workflows

Added PostgreSQL migrations, session accounts, workspace ownership, durable document ingestion, cited retrieval, CSV profiles and forecasts, read-only SQL templates, and a three-node optional research graph with reports. Updated the Next.js gateway and module pages, pinned dependency changes and added a retrieval evaluator. [Workspace setup and limits](WORKSPACE_FEATURES.md)
