# Frontend and backend integration

Browser requests enter Next.js on port 3000. The server-side gateway forwards supported probes to FastAPI on port 8000. The Windows launcher provides both ports and passes the corresponding backend origin when starting a frontend. Docker Compose uses the backend service DNS name. Remote frontend mode uses an explicit HTTP(S) origin.

The startup contract requires the dashboard HTML and the versioned status response through the gateway. When an existing stack is present, the launcher checks it and leaves process ownership unchanged. When it starts services, a checkout-specific Windows named pipe lets the stop command signal the owning launcher without targeting processes by port. PostgreSQL readiness is reported separately.

See the [API integration report](API_INTEGRATION_REPORT.md), [page matrix](FRONTEND_INTEGRATION.md#integration-matrix), and [installation instructions](INSTALLATION.md).
