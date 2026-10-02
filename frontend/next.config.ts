import type { NextConfig } from "next";

// Backend origin. Same var the axios client uses (lib/api.ts); the rewrite runs
// server-side so this is read at build/runtime on the Next server, not shipped.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  // Avatar images load through here so an <img> is same-origin and the session
  // cookie rides along: the backend /files/:id download is JwtAuthGuard-ed, and
  // a cross-origin <img> would send no cookie and 401. Scoped to /api/files
  // only — the axios client talks to the API directly, so /api is otherwise free.
  async rewrites() {
    return [
      {
        source: "/api/files/:path*",
        destination: `${API_URL}/files/:path*`,
      },
    ];
  },
};

export default nextConfig;
