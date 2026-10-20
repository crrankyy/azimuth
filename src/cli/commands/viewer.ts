import { homedir } from "node:os";
import { spawn } from "node:child_process";
import { existsSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildIndex } from "../../core/build-index";
import { loadConfig } from "../../core/config";
import { AzimuthError } from "../../core/errors";
import { ensureViewer, healthy, viewerUrlFor } from "../../server/autostart";
import { exportHtml } from "../../server/export";
import { readViewerRecord } from "../../server/registry";
import { startServer } from "../../server/server";
import { print, printJson, runtime } from "../io";
import type { Command } from "../types";

/**
 * The built viewer: viewer/ next to the bundle (`cli.mjs`, wherever the plugin is installed), or
 * plugin/dist/viewer from source.
 */
export function viewerDir(): string {
  const self = fileURLToPath(import.meta.url);
  const here = dirname(self);
  const dir =
    basename(self) === "cli.mjs"
      ? join(here, "viewer")
      : resolve(here, "../../../plugin/dist/viewer");
  if (!existsSync(join(dir, "index.html"))) {
    throw new AzimuthError(
      "not-found",
      `The viewer isn't built (${dir}). Run \`pnpm build\` in the Azimuth repository.`,
    );
  }
  return dir;
}

function openBrowser(url: string): void {
  const command =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    spawn(command, args, { detached: true, stdio: "ignore" }).unref();
  } catch {
    // No browser launcher; the URL is printed anyway.
  }
}

export const view: Command = {
  usage: "view [--detach] [--stop] [--port <n>] [--no-open] [--open]",
  summary: "Open the live viewer (reuses the running one; --detach runs it in the background)",
  options: {
    detach: { type: "boolean" },
    stop: { type: "boolean" },
    serve: { type: "boolean" },
    port: { type: "string" },
    open: { type: "boolean" },
    "no-open": { type: "boolean" },
    json: { type: "boolean" },
  },
  async run({ values }) {
    const rt = runtime(values);
    if (values.stop) {
      const record = readViewerRecord(rt.root);
      if (!record) {
        print("No viewer is running for this project.");
        return 0;
      }
      try {
        process.kill(record.pid, "SIGTERM");
      } catch {
        // Already stopped.
      }
      print(`Stopped the viewer on port ${record.port}.`);
      return 0;
    }
    const dir = viewerDir();
    const port = values.port ? Number(values.port) : loadConfig(rt.root).config.viewer.port;
    if (values.serve) {
      const server = await startServer({ root: rt.root, viewerDir: dir, port, register: true });
      const stop = () => void server.close();
      process.on("SIGTERM", stop);
      process.on("SIGINT", stop);
      await server.closed;
      return 0;
    }
    if (values.detach) {
      const url = await ensureViewer(rt.root, 5_000);
      if (!url)
        throw new AzimuthError(
          "busy",
          "The viewer did not start within 5 seconds. Try `azimuth view` in the foreground to see why.",
        );
      if (rt.json) printJson({ url });
      else print(url);
      if (values.open) openBrowser(url);
      return 0;
    }
    const existing = readViewerRecord(rt.root);
    if (existing && (await healthy(existing, rt.root)) === "ok") {
      const url = viewerUrlFor(existing);
      print(url);
      if (!values["no-open"]) openBrowser(url);
      return 0;
    }
    const server = await startServer({ root: rt.root, viewerDir: dir, port, register: true });
    print(`Azimuth viewer at ${server.url} (Ctrl-C to stop)`);
    if (!values["no-open"]) openBrowser(server.url);
    const stop = () => void server.close();
    process.on("SIGTERM", stop);
    process.on("SIGINT", stop);
    await server.closed;
    return 0;
  },
};

export const exportCommand: Command = {
  usage: "export [-o <file>]",
  summary: "Write a single self-contained HTML snapshot of the viewer (read-only)",
  options: { out: { type: "string", short: "o" }, json: { type: "boolean" } },
  run({ values }) {
    const rt = runtime(values);
    const out = resolve((values.out as string | undefined) ?? "azimuth-export.html");
    const { index } = buildIndex(rt.root, { mode: "export" });
    writeFileSync(out, exportHtml(viewerDir(), index, { root: rt.root, home: homedir() }));
    const size = statSync(out).size;
    if (rt.json) printJson({ file: out, bytes: size });
    else print(`Wrote ${out} (${Math.round(size / 1024)} KB)`);
  },
};
