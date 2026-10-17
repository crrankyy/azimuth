import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Index } from "../../../src/core/types";

export type Connection = "connecting" | "live" | "disconnected" | "export";

export interface ActionResult {
  ok: boolean;
  status: number;
  error?: string;
  message?: string;
  changed?: string[];
  gate?: Index["features"][number]["derived"]["next_gate"];
}

interface IndexState {
  index: Index | null;
  connection: Connection;
  /** Reconnection attempts since the stream dropped. */
  attempts: number;
  lastUpdate: number;
  /** IDs whose content changed in the latest update (for the brief highlight). */
  changed: Set<string>;
  /** A clock that ticks every second, for relative times. */
  now: number;
  act: (
    action: string,
    ref: string,
    payload?: Record<string, unknown>,
    expect?: string,
  ) => Promise<ActionResult>;
}

const Ctx = createContext<IndexState | null>(null);

interface Boot {
  mode: "live" | "export";
  index: Index | null;
  token: string | null;
  instance: string | null;
}

function readJsonScript<T>(id: string): T | null {
  const el = document.getElementById(id);
  if (!el?.textContent) return null;
  try {
    return JSON.parse(el.textContent) as T;
  } catch {
    return null;
  }
}

function readBoot(): Boot {
  const snapshot = readJsonScript<Index>("azimuth-index");
  if (snapshot) return { mode: "export", index: snapshot, token: null, instance: null };
  const boot = readJsonScript<{ mode: "live"; instance: string }>("azimuth-boot");
  const token =
    document.querySelector<HTMLMetaElement>('meta[name="azimuth-token"]')?.content ?? null;
  return { mode: "live", index: null, token, instance: boot?.instance ?? null };
}

/** IDs of entities whose JSON differs between two indexes. */
function changedIds(before: Index | null, after: Index): Set<string> {
  const out = new Set<string>();
  if (!before) return out;
  const pools = <T extends { id: string }>(pick: (i: Index) => T[]) => {
    const old = new Map(pick(before).map((x) => [x.id, JSON.stringify(x)]));
    for (const x of pick(after)) if (old.get(x.id) !== JSON.stringify(x)) out.add(x.id);
  };
  pools((i) => i.features);
  pools((i) => i.decisions);
  pools((i) => i.questions);
  pools((i) => i.issues);
  pools((i) => i.sessions);
  pools((i) => i.milestones);
  return out;
}

export function IndexProvider({
  children,
  sample,
}: {
  children: ReactNode;
  sample?: () => Promise<Index>;
}) {
  const boot = useMemo(() => readBoot(), []);
  const [index, setIndex] = useState<Index | null>(boot.index);
  const [connection, setConnection] = useState<Connection>(
    boot.mode === "export" ? "export" : "connecting",
  );
  const [attempts, setAttempts] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(() => Date.now());
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const current = useRef<Index | null>(boot.index);

  const apply = useCallback((next: Index) => {
    const ids = changedIds(current.current, next);
    current.current = next;
    setIndex(next);
    setLastUpdate(Date.now());
    if (ids.size > 0) {
      setChanged(ids);
      window.setTimeout(() => setChanged(new Set()), 4_000);
    }
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (boot.mode === "export") return;
    if (!boot.token) {
      // Vite dev server: no backend, render the bundled sample.
      sample?.().then((s) => {
        apply(s);
        setConnection("export");
      });
      return;
    }
    let source: EventSource | null = null;
    let cancelled = false;
    fetch("/api/index")
      .then((r) => r.json() as Promise<Index>)
      .then((i) => !cancelled && apply(i))
      .catch(() => setConnection("disconnected"));
    source = new EventSource("/api/events");
    source.addEventListener("hello", (e) => {
      const hello = JSON.parse((e as MessageEvent<string>).data) as { instance: string };
      // A different server instance means a new token and build: reload the page.
      if (boot.instance && hello.instance !== boot.instance) window.location.reload();
      setConnection("live");
      setAttempts(0);
    });
    source.addEventListener("index", (e) =>
      apply(JSON.parse((e as MessageEvent<string>).data) as Index),
    );
    source.addEventListener("live", (e) => {
      const { live } = JSON.parse((e as MessageEvent<string>).data) as Pick<Index, "live">;
      if (current.current) {
        current.current = { ...current.current, live };
        setIndex(current.current);
        setLastUpdate(Date.now());
      }
    });
    source.onerror = () => {
      setConnection("disconnected");
      setAttempts((n) => n + 1);
    };
    return () => {
      cancelled = true;
      source?.close();
    };
  }, [boot, apply, sample]);

  const act = useCallback<IndexState["act"]>(
    async (action, ref, payload, expect) => {
      if (boot.mode === "export" || !boot.token) {
        return { ok: false, status: 0, error: "export", message: "This is a read-only snapshot." };
      }
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "content-type": "application/json", "x-azimuth-token": boot.token },
        body: JSON.stringify({ action, ref, payload, expect }),
      });
      const body = (await res.json()) as ActionResult & { index?: Index };
      if (body.index) apply(body.index);
      return { ...body, status: res.status };
    },
    [boot, apply],
  );

  const value = useMemo(
    () => ({ index, connection, attempts, lastUpdate, changed, now, act }),
    [index, connection, attempts, lastUpdate, changed, now, act],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useIndexState(): IndexState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useIndexState must be used inside IndexProvider");
  return ctx;
}
