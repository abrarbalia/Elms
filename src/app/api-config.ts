// api-config.ts
const params = new URLSearchParams(window.location.search);
const port = params.get('port') || '5000';
export const API_BASE = `http://127.0.0.1:${port}`;
