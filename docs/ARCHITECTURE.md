# NexusAI Part 1 architecture

The workspace now contains the shared frontend and FastAPI startup path. The Windows launcher starts the two processes with matching ports and passes the backend origin directly to Next.js. Browser calls go through the allowlisted frontend gateway. The database and AI flow below describes the planned capabilities. See [actual frontend and backend integration](FRONTEND_BACKEND_INTEGRATION.md) for the current implementation.

Status as of 25 November 2026: Stage 1 proposal, pending approval.

## Application and data flow

The Next.js App Router frontend uses TypeScript and Tailwind. It talks to FastAPI through a same-origin API proxy. FastAPI owns validation, authentication and workspace authorization, with versioned routes under `/api/v1`. An application service layer coordinates ingestion, retrieval and answers. Service boundaries allow a later orchestration engine to call the same capabilities.

1. An authorized upload lands under a generated storage key in private local storage. The API checks the file format and size, hashes the bytes, and creates the document and a durable PostgreSQL job. The API returns a document ID and processing status.
2. A separate worker claims jobs in short database transactions with a lease, processes them outside the claim transaction and publishes results atomically. Retry attempts and terminal failures are visible through the API. The worker checks that it still owns the lease before publishing. Reconcile interrupted uploads and orphan files. Start with one worker and small embedding batches.
3. Format-specific extractors preserve PDF page references, CSV row references and original extracted text. Separate normalized text supports search. Give each chunk a stable ID and preserve its source offsets. An image-only PDF returns an explicit no-readable-text failure. Use tokenizer-aware chunk limits and configurable overlap.
4. A workspace-scoped retrieval interface provides PostgreSQL keyword search, exact cosine search through pgvector, Reciprocal Rank Fusion, and optional cross-encoder reranking. Apply workspace and metadata constraints before candidate selection. Return stable identifiers, rank, method-specific score and latency. Evaluate HNSW only when exact search is measurably slow at a realistic corpus size and filtered recall has been checked.
5. LangChain assembles a bounded context for a configurable local generation provider. Send passage text as untrusted evidence and expose no tools or secrets to the model. Validate returned evidence IDs and exact supporting quotes against the authorized retrieved passages. Require support per claim and use an extractive response or abstain when support cannot be established. Citation validation alone cannot establish that a passage entails a generated claim. Deliver validated answer segments over SSE if the provider supports streaming, and persist final answers and evidence references.
6. The frontend shows upload status, search results, chat, evidence, history and retrieval metrics directly from authenticated APIs. Structured logs record request IDs, job transitions, timings and errors. Application logs omit secrets, private passages and raw prompts.

## PostgreSQL design

| Entity | Proposed fields and constraints |
| --- | --- |
| Users | UUID, normalized unique email, Argon2id password hash, timestamps |
| Workspaces | UUID, creator FK, name, timestamps |
| Workspace memberships | Workspace/user composite key, role, user lookup index. Start with owner membership for newly created personal workspaces. |
| Documents | Workspace ID, uploader, original name, media type, size, SHA-256, private storage key, metadata and status. Unique workspace and SHA-256. |
| Document chunks | Workspace/document FK, ordinal, page or row locator, original text, source offsets, search text and generated English `tsvector`. Unique document and ordinal, plus a GIN text-search index. |
| Document embeddings | Workspace/chunk FK, embedding model ID, revision and configuration, `vector(384)`. Unique per chunk and embedding configuration. Search only matching configurations. A dimension change requires a schema migration and reindexing. |
| Conversations | Workspace ID, creator, title and timestamps. Private to the creator within the workspace. |
| Messages | Workspace/conversation FK, role, body, timestamps and validated citation references for answers. Index the conversation and stable chronological ordering. |
| Retrieval logs | Workspace, requester and optional conversation or message FK, method, parameters, ranked chunk IDs, model versions and timing. Access follows workspace and conversation permissions where applicable. |
| Processing jobs | Workspace/document FK, status, stage, attempts, availability, lease expiry, lease token and safe error fields. Index claimable jobs and constrain concurrent active jobs for one document. |

Use SQLAlchemy 2 and Psycopg 3 with Alembic migrations. Use composite workspace/resource foreign keys to prevent cross-workspace associations, authorize each resource operation server-side, and test access and leakage with two independent users. The migration role enables pgvector. Application connections use a restricted role. Persist JWT expiry, issuer and audience in the auth contract. For the browser use an HttpOnly same-origin cookie, Secure under HTTPS, with CSRF controls for state-changing requests. Keep credentials in environment-based configuration.

## Initial technology and sizing

Use an isolated Python 3.13 environment with uv. Lock resolved dependencies once tested and keep the CPU PyTorch dependency in the model setup. PostgreSQL 17 with the upstream pgvector image is the first choice once Docker is usable. The backend stays native on Windows. Use BAAI/bge-small-en-v1.5 for English embeddings, cross-encoder/ms-marco-MiniLM-L6-v2 for optional CPU reranking, and Ollama with Qwen2.5 1.5B Q4 as a local generation candidate. Record immutable model revisions or artifact digests before benchmarking.

Start with one ingestion job at a time and modest generation context and concurrency. For local planning, target at least 3–4 GiB of available system RAM before running the AI stack and budget 15–25 GiB of disk for project dependencies, images, model caches and initial data. These estimates require measurement with the chosen runtime. A 16 GiB system would give more room for running the development stack concurrently. Keep mutable files and database data outside OneDrive when possible, using an approved local path. Local inference incurs no API charge. Network downloads and electricity are the main variable local costs.

## References

- [PyTorch installation and supported platforms](https://pytorch.org/get-started/locally/)
- [Next.js installation requirements](https://nextjs.org/docs/app/getting-started/installation)
- [PostgreSQL full-text ranking](https://www.postgresql.org/docs/17/textsearch-controls.html)
- [Upstream pgvector documentation](https://github.com/pgvector/pgvector)
- [BGE embedding model card](https://huggingface.co/BAAI/bge-small-en-v1.5)
- [MiniLM reranker model card](https://huggingface.co/cross-encoder/ms-marco-MiniLM-L6-v2)
- [Quantized Qwen model](https://ollama.com/library/qwen2.5:1.5b)
- [Ollama Windows requirements](https://github.com/ollama/ollama/blob/main/docs/windows.mdx)
