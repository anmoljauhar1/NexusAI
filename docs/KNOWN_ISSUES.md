# Known issues

- Automated backend suites still need verification on a designated server. Local operational health and gateway results are recorded in the [end-to-end report](END_TO_END_TEST_REPORT.md).
- The workspace contains `uv.lock`. Installation from that lockfile on the test server remains unverified.
- Local PostgreSQL and pgvector were verified. Optional semantic, reranking and LLM integrations still require authorized runtime providers. See the [workspace setup](WORKSPACE_FEATURES.md).
- The frontend production build and local gateway checks passed. Browser verification, screenshots, and automated suites require a designated server.
- Account, document, cited chat, analytics, approved SQL and three-step research reports passed a local live smoke check. Dedicated model training, model registry and persistent in-progress agent runs remain unavailable.
- The Compose database profile ran successfully. Container builds and startup for the full frontend and backend images remain unverified.
