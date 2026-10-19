import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import type { Feature, Index } from "../../../../src/core/types";
import { Hint, Page } from "../../components/AppShell";
import { Icon } from "../../components/Icon";
import { EmptyState, Tabs, type TabItem } from "../../components/primitives";
import { useIndexState } from "../../data/IndexProvider";
import { featureById } from "../../data/selectors";
import { href, navigate } from "../../lib/router";
import { ActivityTab } from "./ActivityTab";
import { AsBuiltTab } from "./AsBuiltTab";
import { ContextSection } from "./ContextTab";
import { ContractTab } from "./ContractTab";
import { FeatureHeader } from "./FeatureHeader";
import { FeatureRail } from "./FeatureRail";
import { activityFeed, asBuiltOpen, isTabId, scenariosOf, type TabId } from "./featureData";
import { ImpactTree } from "./ImpactTree";
import { LifecycleCard } from "./Lifecycle";
import { PlanTab } from "./PlanTab";
import { StoriesTab } from "./StoriesTab";
import "./feature.css";

const subscribeHash = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};

/** A task deep link rides in a fourth hash segment: `#/features/F-005/plan/T-005.4`. */
function taskFromHash(): string | null {
  const part = window.location.hash.replace(/^#\/?/, "").split("/")[3];
  return part && /^T-\d{3}\.\d+$/.test(part) ? part : null;
}

const useTaskId = () => useSyncExternalStore(subscribeHash, taskFromHash, () => null);

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return Boolean(
    el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)),
  );
};

/**
 * `j`/`k` open the next/previous feature in index order, keeping the tab. Off on the Plan tab,
 * where PlanTab uses the same keys to move between tasks.
 */
function useFeatureKeys(ids: string[], current: string, tab: string | null): void {
  const latest = useRef({ ids, current, tab });
  useEffect(() => {
    latest.current = { ids, current, tab };
  });
  useEffect(() => {
    let lastG = -Infinity;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      if (e.key === "g") {
        lastG = e.timeStamp;
        return;
      }
      if (e.key !== "j" && e.key !== "k") return;
      // `g k` is the global "go to Knowledge"; leave it alone.
      if (e.timeStamp - lastG < 1_200) return;
      const { ids, current, tab } = latest.current;
      if (tab === "plan") return;
      const next = ids[ids.indexOf(current) + (e.key === "j" ? 1 : -1)];
      if (!next) return;
      e.preventDefault();
      navigate(href("features", next, tab));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

const AS_BUILT_HINT = "Available at close-out, once the feature reaches verifying";

function resolveTab(f: Feature, tab: string | null): TabId {
  if (!isTabId(tab)) return "stories";
  if (tab === "as-built" && !asBuiltOpen(f)) return "stories";
  return tab;
}

function tabItems(f: Feature, index: Index): TabItem[] {
  const d = f.detail;
  const progress = f.derived.progress;
  const open = asBuiltOpen(f);
  const lock = open ? undefined : <Icon name="lock" size={12} />;
  return [
    { id: "context", label: "Context" },
    { id: "impact", label: "Impact", count: d?.impact.length },
    { id: "stories", label: "Stories", count: d ? scenariosOf(f).length : undefined },
    { id: "contract", label: "Contract", count: d?.contract.sections.length },
    {
      id: "plan",
      label: "Plan",
      count: d && progress.total > 0 ? `${progress.done}/${progress.total}` : undefined,
    },
    { id: "activity", label: "Activity", count: d ? activityFeed(index, f).length : undefined },
    {
      id: "as-built",
      label: "As-built",
      disabled: !open,
      title: open ? undefined : AS_BUILT_HINT,
      icon: lock,
    },
  ];
}

function TabContent({ f, tab, taskId }: { f: Feature; tab: TabId; taskId: string | null }) {
  if (!f.detail) {
    return (
      <EmptyState title="Details aren't in this index">
        This index carries only the summary of {f.id}. Its context, stories, contract, plan and
        activity appear when the index includes the feature's detail.
      </EmptyState>
    );
  }
  const tabs: Record<TabId, ReactNode> = {
    context: <ContextSection f={f} />,
    impact: <ImpactTree f={f} />,
    stories: <StoriesTab f={f} />,
    contract: <ContractTab f={f} />,
    plan: <PlanTab feature={f} taskId={taskId} />,
    activity: <ActivityTab f={f} />,
    "as-built": <AsBuiltTab f={f} />,
  };
  return <>{tabs[tab]}</>;
}

/** Feature detail: header, lifecycle and gate, tabs, and the related-items rail. */
export function FeatureDetailScreen({ id, tab }: { id: string; tab: string | null }) {
  const { index } = useIndexState();
  const taskId = useTaskId();
  const ids = index?.features.map((x) => x.id) ?? [];
  useFeatureKeys(ids, id, tab);
  const crumbs = [
    { label: "Features", href: href("features") },
    { label: <span className="fd-crumb-id">{id}</span> },
  ];
  const hints = (
    <Hint
      keys={["j", "k"]}
      label={tab === "plan" ? "previous / next task" : "previous / next feature"}
    />
  );
  const f = index ? featureById(index, id) : undefined;
  if (!index || !f) {
    return (
      <Page crumbs={crumbs} hints={hints}>
        <EmptyState title={`${id} isn't in this index`}>
          <a href={href("features")}>Back to all features</a>
        </EmptyState>
      </Page>
    );
  }
  const selected = resolveTab(f, tab);
  return (
    <Page crumbs={crumbs} hints={hints}>
      <div className="fd">
        <div className="fd-top">
          <FeatureHeader f={f} />
          <LifecycleCard f={f} />
          <Tabs
            items={tabItems(f, index)}
            selected={selected}
            onSelect={(next) => navigate(href("features", f.id, next))}
            trailing={f.file}
          />
        </div>
        <div className="fd-body">
          <div className="fd-main" role="tabpanel" aria-label={selected}>
            <TabContent f={f} tab={selected} taskId={taskId} />
          </div>
          <FeatureRail f={f} />
        </div>
      </div>
    </Page>
  );
}
