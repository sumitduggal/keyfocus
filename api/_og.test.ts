import { afterEach, describe, expect, it, vi } from "vitest";
import { assertPublicUrl, handleOg, isPrivateHost, parseMeta } from "./_og.ts";

describe("og guard", () => {
  it("blocks private and local hosts", () => {
    for (const host of ["localhost", "127.0.0.1", "10.1.2.3", "192.168.0.1", "172.20.0.1", "169.254.169.254", "[::1]", "::ffff:127.0.0.1", "fd00::1", "foo.local", "0.0.0.0"]) {
      expect(isPrivateHost(host), host).toBe(true);
    }
    expect(isPrivateHost("8.8.8.8")).toBe(false);
    expect(isPrivateHost("example.com")).toBe(false);
  });
  it("rejects bad schemes and credentials", async () => {
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow();
    await expect(assertPublicUrl("http://user:pw@8.8.8.8/")).rejects.toThrow();
    await expect(assertPublicUrl("http://169.254.169.254/latest")).rejects.toThrow();
  });
  it("answers a missing or private url without fetching", async () => {
    expect((await handleOg(null, false)).status).toBe(400);
    expect((await handleOg("http://127.0.0.1:3000", false)).status).toBe(502);
    expect((await handleOg("http://127.0.0.1:3000", true)).body).toEqual({ ok: false, status: 0 });
  });
});

describe("og parsing", () => {
  it("reads OpenGraph, falls back to title, and resolves relative urls", () => {
    const html = `<head><title>Plain &amp; title</title>
      <meta property="og:title" content="OG Title"><meta content='A "desc"' name="description">
      <meta property="og:image" content="/img/cover.png"><link rel="shortcut icon" href="/f.ico"></head>`;
    const meta = parseMeta(html, new URL("https://www.site.com/post/1"));
    expect(meta).toEqual({ title: "OG Title", description: 'A "desc"', image: "https://www.site.com/img/cover.png", favicon: "https://www.site.com/f.ico", siteName: "site.com" });
    expect(parseMeta("<title>Just title</title>", new URL("https://a.com")).title).toBe("Just title");
  });
});

// The BFF's network paths, with fetch faked. Public IP literals skip the DNS lookup.
describe("og fetching", () => {
  const html = (body: string, init: ResponseInit = {}) =>
    new Response(body, { status: 200, headers: { "content-type": "text/html" }, ...init });
  afterEach(() => vi.unstubAllGlobals());

  it("follows a redirect to a public page", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "http://8.8.4.4/final" } }))
      .mockResolvedValueOnce(html("<title>Final</title>")));
    const result = await handleOg("http://8.8.8.8/", false);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ title: "Final" });
  });
  it("refuses a redirect to a private address", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await handleOg("http://8.8.8.8/", false);
    expect(result.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("gives up after too many redirects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(null, { status: 302, headers: { location: "http://8.8.4.4/" } })));
    expect((await handleOg("http://8.8.8.8/", false)).status).toBe(502);
  });
  it("reads only the first 512 KB of a huge page", async () => {
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = new TextEncoder().encode(sent === 0 ? "<title>Big</title>" + "x".repeat(100_000) : "x".repeat(100_000));
        sent += chunk.length;
        if (sent > 5_000_000) controller.close();
        else controller.enqueue(chunk);
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { headers: { "content-type": "text/html" } })));
    const result = await handleOg("http://8.8.8.8/", false);
    expect(result.body).toMatchObject({ title: "Big" });
    expect(sent).toBeLessThan(1_000_000);
  });
  it("skips non-HTML pages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("%PDF", { headers: { "content-type": "application/pdf" } })));
    expect((await handleOg("http://8.8.8.8/a.pdf", false)).body).toMatchObject({ title: "8.8.8.8", image: null });
  });
  it("checks links: ok, missing, HEAD refused, and unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    expect((await handleOg("http://8.8.8.8/", true)).body).toEqual({ ok: true, status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    expect((await handleOg("http://8.8.8.8/", true)).body).toEqual({ ok: false, status: 404 });
    const retry = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 405 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", retry);
    expect((await handleOg("http://8.8.8.8/", true)).body).toEqual({ ok: true, status: 200 });
    expect(retry.mock.calls.map((call) => call[1].method)).toEqual(["HEAD", "GET"]);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect((await handleOg("http://8.8.8.8/", true)).body).toEqual({ ok: false, status: 0 });
  });
});
