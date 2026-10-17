import { existsSync, readdirSync, statSync, watch, type FSWatcher } from "node:fs";
import { basename, join, relative } from "node:path";

export type ChangeKind = "content" | "live";

export interface WatchOptions {
  /** Directories watched recursively; changes under `liveDir` are reported as "live". */
  dirs: string[];
  liveDir: string;
  /** Extra files (git HEAD, refs) whose changes count as content changes. */
  files: string[];
  onChange: (kind: ChangeKind) => void;
  /** Use fs.watch (default true). Polling always runs as a fallback. */
  useFsWatch?: boolean;
  pollMs?: number;
  debounceMs?: number;
  maxWaitMs?: number;
}

/** Files that change because of the server or the CLI's own bookkeeping, not project state. */
const IGNORED =
  /(^|\/)(index\.json|viewer\.json|viewer\.lock|write\.lock|ids\.json|hooks\.log|node-path)$|\.tmp$/;

function signature(paths: string[], liveDir: string): { content: string; live: string } {
  const content: string[] = [];
  const live: string[] = [];
  const visit = (path: string) => {
    let st;
    try {
      st = statSync(path);
    } catch {
      return;
    }
    if (st.isDirectory()) {
      for (const name of readdirSync(path)) visit(join(path, name));
      return;
    }
    if (IGNORED.test(path)) return;
    const entry = `${path}:${st.mtimeMs}:${st.size}`;
    (path.startsWith(liveDir) ? live : content).push(entry);
  };
  for (const p of paths) visit(p);
  return { content: content.sort().join("|"), live: live.sort().join("|") };
}

/**
 * Watches project files with fs.watch (as a hint) and a stat-signature poll (as the source of
 * truth), debouncing bursts such as branch switches into one notification per kind.
 */
export function watchProject(opts: WatchOptions): { close: () => void } {
  const debounceMs = opts.debounceMs ?? 200;
  const maxWaitMs = opts.maxWaitMs ?? 1_000;
  const pending = new Set<ChangeKind>();
  let timer: NodeJS.Timeout | null = null;
  let firstAt = 0;
  const all = [...opts.dirs, ...opts.files];
  let last = signature(all, opts.liveDir);

  const flush = () => {
    timer = null;
    last = signature(all, opts.liveDir);
    const kinds = [...pending];
    pending.clear();
    // Content changes trigger a full rebuild, which includes live data.
    opts.onChange(kinds.includes("content") ? "content" : "live");
  };
  const schedule = (kind: ChangeKind) => {
    pending.add(kind);
    const now = Date.now();
    if (!timer) firstAt = now;
    if (timer) clearTimeout(timer);
    const wait = Math.min(debounceMs, Math.max(0, firstAt + maxWaitMs - now));
    timer = setTimeout(flush, wait);
  };

  const watchers: FSWatcher[] = [];
  if (opts.useFsWatch !== false) {
    for (const dir of opts.dirs) {
      if (!existsSync(dir)) continue;
      try {
        const w = watch(dir, { recursive: true }, (_event, name) => {
          const file = name ? join(dir, name.toString()) : dir;
          if (IGNORED.test(file)) return;
          schedule(file.startsWith(opts.liveDir) ? "live" : "content");
        });
        w.on("error", () => undefined);
        watchers.push(w);
      } catch {
        // Recursive watching unsupported here; polling covers it.
      }
    }
    for (const file of opts.files) {
      const dir = join(file, "..");
      if (!existsSync(dir)) continue;
      try {
        const w = watch(dir, (_event, name) => {
          if (name && basename(file) === name.toString()) schedule("content");
        });
        w.on("error", () => undefined);
        watchers.push(w);
      } catch {
        // Polling covers it.
      }
    }
  }

  const poll = setInterval(() => {
    if (timer) return;
    const now = signature(all, opts.liveDir);
    if (now.content !== last.content) schedule("content");
    else if (now.live !== last.live) schedule("live");
  }, opts.pollMs ?? 2_000);
  poll.unref();

  return {
    close: () => {
      clearInterval(poll);
      if (timer) clearTimeout(timer);
      for (const w of watchers) w.close();
    },
  };
}

export function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
}
