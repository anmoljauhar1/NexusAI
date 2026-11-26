export function backendOrigin() {
  const url = new URL(process.env.NEXUSAI_BACKEND_URL ?? "http://127.0.0.1:8000");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) {
    throw new Error("NEXUSAI_BACKEND_URL must be an HTTP origin.");
  }
  return url.origin;
}
