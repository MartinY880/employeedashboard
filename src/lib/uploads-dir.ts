import { join, resolve } from "path";

/**
 * Persistent uploads directory that survives standalone rebuilds.
 *
 * In standalone mode process.cwd() resolves inside .next/standalone/<project>/,
 * so uploads stored there are destroyed on every `npm run build`.
 * This utility walks up to the real project root when it detects the standalone path,
 * or honours the UPLOADS_DIR env-var if explicitly set (e.g. in Docker).
 */
function getUploadsBaseDir(): string {
  if (process.env.UPLOADS_DIR) {
    return resolve(process.env.UPLOADS_DIR);
  }

  const cwd = process.cwd();
  const marker = join(".next", "standalone");
  const idx = cwd.indexOf(marker);
  if (idx !== -1) {
    // cwd is e.g. /root/proconnect/.next/standalone/proconnect — walk up
    return join(cwd.substring(0, idx), "uploads");
  }

  return join(cwd, "uploads");
}

export const UPLOADS_BASE = getUploadsBaseDir();
