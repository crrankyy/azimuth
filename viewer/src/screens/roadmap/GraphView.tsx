import { useMemo, useState } from "react";
import { DependencyGraph, dependencyEdges } from "../../components/DependencyGraph";
import { Eyebrow, Segmented } from "../../components/primitives";
import { useIndexState } from "../../data/IndexProvider";
import { plural } from "../../lib/format";
import { isParked, orderedMilestones } from "../features/model";
import "./roadmap.css";

const ALL = "all";
/** Beyond this many milestones the filter becomes a select. */
const SEGMENTED_MAX = 6;

export function RoadmapGraph() {
  const { index } = useIndexState();
  const [milestone, setMilestone] = useState(ALL);
  const [showParked, setShowParked] = useState(false);
  const all = useMemo(() => index?.features ?? [], [index]);
  const features = useMemo(
    () =>
      all.filter(
        (f) => (showParked || !isParked(f)) && (milestone === ALL || f.milestone === milestone),
      ),
    [all, showParked, milestone],
  );
  if (!index) return null;

  const edges = dependencyEdges(features).length;
  const milestones = [...index.milestones].sort((a, b) => a.id.localeCompare(b.id));
  const parked = all.filter(isParked).length;
  const options = [
    { value: ALL, label: "All" },
    ...milestones.map((m) => ({ value: m.id, label: m.id })),
  ];

  return (
    <div className="rm-page">
      <div className="rm-heading">
        <h1 className="page-title">Dependencies</h1>
        <span className="rm-sub-title">
          {plural(features.length, "feature")} · {plural(edges, "edge")} from depends_on
        </span>
        <span className="spacer" />
        <Eyebrow className="rm-filter-label">Milestone</Eyebrow>
        {milestones.length <= SEGMENTED_MAX ? (
          <Segmented
            label="Filter by milestone"
            value={milestone}
            onChange={setMilestone}
            options={options}
          />
        ) : (
          <select
            className="az-select"
            aria-label="Filter by milestone"
            value={milestone}
            onChange={(e) => setMilestone(e.target.value)}
          >
            <option value={ALL}>All milestones</option>
            {orderedMilestones(index.milestones).map((m) => (
              <option key={m.id} value={m.id}>
                {m.id} {m.title}
              </option>
            ))}
          </select>
        )}
        <label className="ft-ctl ft-check">
          <input
            type="checkbox"
            checked={showParked}
            onChange={(e) => setShowParked(e.target.checked)}
          />
          Show parked <span className="ft-n">{parked}</span>
        </label>
      </div>
      <DependencyGraph features={features} all={all} />
    </div>
  );
}
