import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useIndexState, type ActionResult } from "../data/IndexProvider";
import { Icon } from "./Icon";
import { StatusGlyph } from "./Status";

interface Toast {
  id: number;
  title: string;
  detail?: string;
  tone: "success" | "danger";
}

interface UiState {
  toast: (t: Omit<Toast, "id" | "tone"> & { tone?: Toast["tone"] }) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  problemsOpen: boolean;
  setProblemsOpen: (open: boolean) => void;
}

const UiCtx = createContext<UiState | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [problemsOpen, setProblemsOpen] = useState(false);
  const seq = useRef(0);
  const dismiss = (id: number) => setToasts((all) => all.filter((t) => t.id !== id));
  const toast = useCallback<UiState["toast"]>((t) => {
    const id = ++seq.current;
    setToasts((all) => [...all, { ...t, id, tone: t.tone ?? "success" }]);
    window.setTimeout(() => dismiss(id), 6_000);
  }, []);
  return (
    <UiCtx.Provider value={{ toast, paletteOpen, setPaletteOpen, problemsOpen, setProblemsOpen }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast" role="status">
            <StatusGlyph glyph={t.tone === "success" ? "s-done" : "s-failing"} />
            <div>
              <div>{t.title}</div>
              {t.detail && <div className="file">{t.detail}</div>}
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
            >
              <Icon name="close" size={12} />
            </button>
          </div>
        ))}
      </div>
    </UiCtx.Provider>
  );
}

export function useUi(): UiState {
  const ctx = useContext(UiCtx);
  if (!ctx) throw new Error("useUi must be used inside UiProvider");
  return ctx;
}

/**
 * Runs a viewer action. Success shows a toast naming the files written; gate failures are
 * returned for the caller's dialog to show; other failures toast their message.
 */
export function useAction(): (
  action: string,
  ref: string,
  payload?: Record<string, unknown>,
  expect?: string,
) => Promise<ActionResult> {
  const { act } = useIndexState();
  const { toast } = useUi();
  return useCallback(
    async (action, ref, payload, expect) => {
      const result = await act(action, ref, payload, expect);
      if (result.ok) {
        toast({
          title: result.message ?? `${ref} updated`,
          detail: result.changed?.length ? `Updated ${result.changed.join(", ")}` : undefined,
        });
      } else if (result.error !== "gate") {
        toast({ title: result.message ?? `Couldn't update ${ref}`, tone: "danger" });
      }
      return result;
    },
    [act, toast],
  );
}

/** A modal dialog: Esc or the backdrop closes it; focus moves into it. */
export function Dialog({
  title,
  subtitle,
  children,
  footer,
  onClose,
  width,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  width?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    box.current
      ?.querySelector<HTMLElement>("textarea, input, button.lc-btn-primary, button")
      ?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={box}
        className="dialog"
        role="dialog"
        aria-modal="true"
        style={width ? { width } : undefined}
      >
        <div className="dialog-head">
          <h2>{title}</h2>
          {subtitle && (
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              {subtitle}
            </div>
          )}
        </div>
        {children && <div className="dialog-body">{children}</div>}
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}
