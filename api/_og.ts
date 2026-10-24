// The bookmarks BFF: GET /api/og?url=<page>[&check=1].
// Returns OpenGraph data for a page, or with check=1 whether the link still answers.
// One plain Node (req, res) handler, used by Vite in development and by Vercel in production.
// The leading underscore keeps Vercel from also serving this file as a route.
import type { IncomingMessage, ServerResponse } from "node:http";
import { isIP } from "node:net";

const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8000;

export interface PageMeta {
  title: string;
  description: string;
  image: string | null;
  favicon: string | null;
  siteName: string;
}

// Hostnames and addresses that point at this machine or a private network.
export function isPrivateHost(host: string): boolean {
  const name = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (name === "localhost" || name.endsWith(".localhost") || name.endsWith(".local") || name.endsWith(".internal")) return true;
  const kind = isIP(name);
  if (kind === 4) {
    const [a, b] = name.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  if (kind === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(name);
    if (mapped) return isPrivateHost(mapped[1]);
    return name === "::" || name === "::1" || /^f[cd]/.test(name) || /^fe[89ab]/.test(name);
  }
  return false;
}

// Rejects anything that is not a public http(s) address. A name that resolves to a private address
// is rejected too where DNS is available; shortcut: skipped on runtimes without node:dns, and a DNS
// rebind between this check and the fetch is not covered, so upgrade by fetching through a pinned IP.
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http and https links");
  if (url.username || url.password) throw new Error("Links with credentials are not allowed");
  if (isPrivateHost(url.hostname)) throw new Error("That address is private");
  if (!isIP(url.hostname.replace(/^\[|\]$/g, ""))) {
    try {
      const { lookup } = await import("node:dns/promises");
      const addresses = await lookup(url.hostname, { all: true });
      if (addresses.some((entry) => isPrivateHost(entry.address))) throw new Error("That address is private");
    } catch (error) {
      if (error instanceof Error && error.message === "That address is private") throw error;
      throw new Error("Could not find that site");
    }
  }
  return url;
}

// Follows redirects by hand so every hop is checked, not only the first address.
async function fetchChecked(start: string, method: "GET" | "HEAD"): Promise<{ response: Response; url: URL }> {
  let url = await assertPublicUrl(start);
  for (let hop = 0; ; hop++) {
    const response = await fetch(url, {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "Mozilla/5.0 (compatible; KeyfocusBookmarks/1.0)", accept: "text/html,*/*;q=0.8" },
    });
    const next = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !next) return { response, url };
    if (hop >= MAX_REDIRECTS) throw new Error("Too many redirects");
    url = await assertPublicUrl(new URL(next, url).href);
  }
}

async function readLimited(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  await reader.cancel().catch(() => undefined);
  return new TextDecoder().decode(Buffer.concat(chunks));
}

const decode = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();

function metaContent(html: string, key: string): string {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = /(?:property|name)\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]?.toLowerCase();
    if (name !== key) continue;
    const content = /content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i.exec(tag);
    if (content) return decode(content[1] ?? content[2] ?? "");
  }
  return "";
}

export function parseMeta(html: string, page: URL): PageMeta {
  const resolve = (value: string) => {
    try {
      return value ? new URL(value, page).href : null;
    } catch {
      return null;
    }
  };
  const icon = (html.match(/<link\b[^>]*>/gi) ?? []).find((tag) => /rel\s*=\s*["'][^"']*icon/i.test(tag));
  const iconHref = icon ? /href\s*=\s*["']([^"']*)["']/i.exec(icon)?.[1] : undefined;
  return {
    title: metaContent(html, "og:title") || decode(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? "") || page.hostname,
    description: metaContent(html, "og:description") || metaContent(html, "description"),
    image: resolve(metaContent(html, "og:image") || metaContent(html, "twitter:image")),
    favicon: resolve(iconHref ?? "/favicon.ico"),
    siteName: metaContent(html, "og:site_name") || page.hostname.replace(/^www\./, ""),
  };
}

export type OgResult = { status: number; body: PageMeta | { ok: boolean; status: number } | { error: string } };

export async function handleOg(target: string | null, check: boolean): Promise<OgResult> {
  if (!target) return { status: 400, body: { error: "Missing url" } };
  try {
    if (check) {
      // Some servers refuse HEAD, so a 405/403/501 is retried as GET before calling the link broken.
      let { response } = await fetchChecked(target, "HEAD");
      if ([403, 405, 501].includes(response.status)) {
        ({ response } = await fetchChecked(target, "GET"));
        await response.body?.cancel().catch(() => undefined);
      }
      return { status: 200, body: { ok: response.status < 400, status: response.status } };
    }
    const { response, url } = await fetchChecked(target, "GET");
    if (!(response.headers.get("content-type") ?? "").includes("html")) {
      await response.body?.cancel().catch(() => undefined);
      return { status: 200, body: { title: url.hostname, description: "", image: null, favicon: null, siteName: url.hostname } };
    }
    return { status: 200, body: parseMeta(await readLimited(response), url) };
  } catch (error) {
    if (check) return { status: 200, body: { ok: false, status: 0 } };
    return { status: 502, body: { error: error instanceof Error ? error.message : "Could not fetch that page" } };
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const params = new URL(req.url ?? "/", "http://localhost").searchParams;
  const { status, body } = await handleOg(params.get("url"), params.get("check") === "1");
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "private, max-age=3600");
  res.end(JSON.stringify(body));
}
