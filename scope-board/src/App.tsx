import React, { useEffect, useMemo, useState } from "react";

type LaneId = "v1" | "v2" | "v3";
type Area =
  | "Chaperone App"
  | "Mission"
  | "Chat"
  | "Settings"
  | "Backend Glue"
  | "Dispatch Web"
  | "Dev / Artifacts";

type Feature = {
  id: string;
  title: string;
  area: Area;
  detail: string;
  defaultLane: LaneId;
  risk: "low" | "medium" | "high";
};

type Lane = {
  id: LaneId;
  title: string;
  caption: string;
};

type DeckDragState = {
  featureId: string;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
};

const lanes: Lane[] = [
  { id: "v1", title: "This Version", caption: "Needed for the slim build" },
  { id: "v2", title: "V2", caption: "Soon, but not blocking launch" },
  { id: "v3", title: "V3", caption: "Nice later, park it here" },
];

const features: Feature[] = [
  { id: "login", title: "Backend Login", area: "Chaperone App", detail: "Email/password auth, token storage, sign-out.", defaultLane: "v1", risk: "high" },
  { id: "location-gate", title: "Location Permission Gate", area: "Chaperone App", detail: "Blocks app until location access is granted.", defaultLane: "v1", risk: "high" },
  { id: "home-current", title: "Current Ride", area: "Chaperone App", detail: "Active ride map preview, rider, route, and action entry.", defaultLane: "v1", risk: "high" },
  { id: "ride-requests", title: "Ride Requests", area: "Chaperone App", detail: "Pending ride cards with accept, decline, chat.", defaultLane: "v1", risk: "high" },
  { id: "scheduled-rides", title: "Scheduled Rides", area: "Chaperone App", detail: "Accepted upcoming ride list.", defaultLane: "v1", risk: "medium" },
  { id: "past-rides", title: "Past Rides", area: "Chaperone App", detail: "Completed and cancelled ride history.", defaultLane: "v2", risk: "low" },
  { id: "ride-details", title: "Ride Details", area: "Chaperone App", detail: "Route map, care notes, contact actions, accept/decline.", defaultLane: "v1", risk: "high" },
  { id: "assignment-alert", title: "New Ride Alert", area: "Chaperone App", detail: "Modal alert when polling discovers a new ride.", defaultLane: "v2", risk: "medium" },
  { id: "status-toast", title: "Ride Status Toast", area: "Chaperone App", detail: "Lightweight banner when backend status changes.", defaultLane: "v2", risk: "low" },
  { id: "pull-refresh", title: "Pull To Refresh", area: "Chaperone App", detail: "Manual ride refresh on the home screen.", defaultLane: "v1", risk: "medium" },
  { id: "mission-map", title: "Active Mission Map", area: "Mission", detail: "Full mission route, driver dot, fit/recenter controls.", defaultLane: "v1", risk: "high" },
  { id: "mission-stages", title: "Mission Stage Flow", area: "Mission", detail: "Pickup, facility, return pickup, arrive home.", defaultLane: "v1", risk: "high" },
  { id: "mission-status", title: "Mission Status Updates", area: "Mission", detail: "PATCH ride status as driver advances or cancels.", defaultLane: "v1", risk: "high" },
  { id: "mission-background", title: "Background Location", area: "Mission", detail: "Keep sending GPS while active mission is open/backgrounded.", defaultLane: "v1", risk: "high" },
  { id: "navigation", title: "Navigation Launcher", area: "Mission", detail: "Open installed map app for current stop.", defaultLane: "v1", risk: "medium" },
  { id: "rider-profile", title: "Rider Profile Modal", area: "Mission", detail: "Care notes, trip type, emergency contact view.", defaultLane: "v2", risk: "low" },
  { id: "emergency", title: "Emergency Actions", area: "Mission", detail: "Call dispatch, rider emergency contact, or 911.", defaultLane: "v1", risk: "high" },
  { id: "admin-chat", title: "Admin Chat", area: "Chat", detail: "Ride message list, composer, and dispatch call button.", defaultLane: "v1", risk: "high" },
  { id: "chat-polling", title: "Chat Polling", area: "Chat", detail: "Refresh messages and status every 2.5 seconds.", defaultLane: "v1", risk: "medium" },
  { id: "typing-read", title: "Typing / Read Receipts", area: "Chat", detail: "Typing indicator and sent/read state.", defaultLane: "v3", risk: "low" },
  { id: "checkpoint-cards", title: "Checkpoint Cards", area: "Chat", detail: "Render mission JSON status as structured chat cards.", defaultLane: "v3", risk: "medium" },
  { id: "mission-chat-posts", title: "Mission Auto-Posts To Chat", area: "Chat", detail: "Send system checkpoint messages from mission actions.", defaultLane: "v3", risk: "medium" },
  { id: "settings-core", title: "Settings + Sign Out", area: "Settings", detail: "Profile readout, location toggle, haptics, sign-out.", defaultLane: "v1", risk: "medium" },
  { id: "editable-profile", title: "Editable Local Profile", area: "Settings", detail: "Locally stored name, certifications, vehicle.", defaultLane: "v2", risk: "low" },
  { id: "push-toggle", title: "Push Toggle UI", area: "Settings", detail: "Settings switch while push code is disabled.", defaultLane: "v3", risk: "low" },
  { id: "auto-accept", title: "Auto-Accept Toggle", area: "Settings", detail: "UI-only automatic high-priority mission setting.", defaultLane: "v3", risk: "low" },
  { id: "qr-scanner", title: "QR Driver Verification", area: "Settings", detail: "Camera scanner for another driver's verification QR.", defaultLane: "v3", risk: "medium" },
  { id: "info-pages", title: "Info Placeholder Pages", area: "Settings", detail: "Help, issue report, terms, privacy, earnings pages.", defaultLane: "v3", risk: "low" },
  { id: "fleet-client", title: "Fleet API Client", area: "Backend Glue", detail: "Login, rides, details, statuses, location updates.", defaultLane: "v1", risk: "high" },
  { id: "ride-normalizer", title: "Ride Payload Normalization", area: "Backend Glue", detail: "Flexible parsing for Suresh's evolving payload shapes.", defaultLane: "v1", risk: "high" },
  { id: "directions", title: "Directions Fallback", area: "Backend Glue", detail: "Fetch fallback route geometry when backend lacks it.", defaultLane: "v2", risk: "medium" },
  { id: "push-registration", title: "Push Registration Hook", area: "Backend Glue", detail: "Register Expo push token when notifications return.", defaultLane: "v3", risk: "medium" },
  { id: "legacy-dispatch", title: "Legacy Dispatch Console", area: "Dispatch Web", detail: "Separate Vite dashboard for multi-driver ops experiments.", defaultLane: "v3", risk: "medium" },
  { id: "dispatch-map", title: "Dispatch Map + Simulators", area: "Dispatch Web", detail: "Browser map, route adherence, manual/auto location posts.", defaultLane: "v3", risk: "medium" },
  { id: "temp-chat", title: "Temporary Chat Backend", area: "Dev / Artifacts", detail: "Local Flask chat server until canonical backend owns chat.", defaultLane: "v2", risk: "medium" },
  { id: "handoff-docs", title: "Backend Handoff Docs", area: "Dev / Artifacts", detail: "API inventory and implementation notes for Suresh.", defaultLane: "v2", risk: "low" },
  { id: "demo-outputs", title: "Demo Presentation Outputs", area: "Dev / Artifacts", detail: "Generated slides, screenshots, and presentation artifacts.", defaultLane: "v3", risk: "low" },
  { id: "tests", title: "Parsing / Chat Tests", area: "Dev / Artifacts", detail: "Unit tests around ride parsing and temp chat behavior.", defaultLane: "v2", risk: "medium" },
];

const storageKey = "trustedriders-scope-board-v1";
const reviewedStorageKey = "trustedriders-scope-board-reviewed-v1";

function loadAssignments(): Record<string, LaneId> {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Record<string, LaneId>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function loadReviewedIds(): string[] {
  try {
    const stored = localStorage.getItem(reviewedStorageKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as string[];
    return Array.isArray(parsed) ? parsed.filter((id) => features.some((feature) => feature.id === id)) : [];
  } catch {
    return [];
  }
}

export function App() {
  const [assignments, setAssignments] = useState<Record<string, LaneId>>(loadAssignments);
  const [reviewedIds, setReviewedIds] = useState<string[]>(loadReviewedIds);
  const [view, setView] = useState<"deck" | "board">(() => (loadReviewedIds().length >= features.length ? "board" : "deck"));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [activeBucket, setActiveBucket] = useState<LaneId | null>(null);
  const [deckDrag, setDeckDrag] = useState<DeckDragState | null>(null);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<Area | "All">("All");

  const featureLane = (feature: Feature) => assignments[feature.id] ?? feature.defaultLane;

  const scopedFeatures = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return features.filter((feature) => {
      const areaMatch = area === "All" || feature.area === area;
      const queryMatch =
        !normalizedQuery ||
        `${feature.title} ${feature.area} ${feature.detail}`.toLowerCase().includes(normalizedQuery);
      return areaMatch && queryMatch;
    });
  }, [area, query]);

  const moveFeature = (featureId: string, laneId: LaneId) => {
    setAssignments((current) => {
      const next = { ...current, [featureId]: laneId };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };

  const sortFeature = (featureId: string, laneId: LaneId) => {
    moveFeature(featureId, laneId);
    setReviewedIds((current) => {
      const next = current.includes(featureId) ? current : [...current, featureId];
      localStorage.setItem(reviewedStorageKey, JSON.stringify(next));
      if (next.length >= features.length) setView("board");
      return next;
    });
  };

  const resetBoard = () => {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(reviewedStorageKey);
    setAssignments({});
    setReviewedIds([]);
    setView("deck");
    setQuery("");
    setArea("All");
  };

  const exportSummary = async () => {
    const lines = lanes.flatMap((lane) => {
      const laneFeatures = features.filter((feature) => featureLane(feature) === lane.id);
      return [
        `## ${lane.title}`,
        ...laneFeatures.map((feature) => `- ${feature.title} (${feature.area})`),
        "",
      ];
    });
    await navigator.clipboard?.writeText(lines.join("\n"));
  };

  const copyImplementationPrompt = async () => {
    const featuresByLane = Object.fromEntries(
      lanes.map((lane) => [
        lane.id,
        features.filter((feature) => featureLane(feature) === lane.id),
      ]),
    ) as Record<LaneId, Feature[]>;

    const formatFeatureList = (items: Feature[]) =>
      items
        .map((feature) => `- ${feature.title} [${feature.area}; ${feature.risk} risk]: ${feature.detail}`)
        .join("\n");

    const prompt = `We are on branch Slim-thicc-5-20-26 in /Users/benmichals/ClaudeCodeTest/COMPANIES/TRUSTEDRIDERS_April_2026.

Please slim the TrustedRiders app according to this sorted scope board.

Keep in THIS VERSION:
${formatFeatureList(featuresByLane.v1) || "- None selected"}

Move out of this version / defer to V2:
${formatFeatureList(featuresByLane.v2) || "- None selected"}

Move out of this version / defer to V3:
${formatFeatureList(featuresByLane.v3) || "- None selected"}

Implementation rules:
- Preserve the V1 features end to end and keep the app buildable.
- Remove or hide V2/V3 features from the user-facing app unless they are required infrastructure for a V1 feature.
- When a deferred feature has shared code, delete it only if no V1 path depends on it.
- Update navigation, settings rows, imports, tests, docs, and package dependencies to match the slimmed scope.
- Do not remove unrelated user changes.
- After changes, run the relevant build/typecheck commands and summarize what was removed, what stayed, and any deferred-code leftovers.`;

    await navigator.clipboard?.writeText(prompt);
  };

  const areas = useMemo(() => ["All", ...Array.from(new Set(features.map((feature) => feature.area)))] as Array<Area | "All">, []);
  const totalByLane = (laneId: LaneId) => features.filter((feature) => featureLane(feature) === laneId).length;
  const currentFeature = features.find((feature) => !reviewedIds.includes(feature.id)) ?? null;
  const completedCount = reviewedIds.length;

  useEffect(() => {
    if (!deckDrag) return;

    const handlePointerMove = (event: PointerEvent) => {
      setDeckDrag((current) => current ? { ...current, x: event.clientX, y: event.clientY } : current);
      const bucket = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-lane]");
      setActiveBucket((bucket?.dataset.lane as LaneId | undefined) ?? null);
    };

    const handlePointerUp = (event: PointerEvent) => {
      const bucket = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-lane]");
      const laneId = bucket?.dataset.lane as LaneId | undefined;
      if (laneId) sortFeature(deckDrag.featureId, laneId);
      setDeckDrag(null);
      setDraggingId(null);
      setActiveBucket(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [deckDrag]);

  return (
    <main className="app-shell">
      <section className="topbar" aria-labelledby="scope-title">
        <div>
          <p className="eyebrow">Slim-thicc scope sorter</p>
          <h1 id="scope-title">TrustedRiders feature board</h1>
        </div>
        <div className="toolbar" aria-label="Board controls">
          <label className="search">
            <span>Search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ride, chat, dispatch..."
            />
          </label>
          <label className="select">
            <span>Area</span>
            <select value={area} onChange={(event) => setArea(event.target.value as Area | "All")}>
              {areas.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <button className="ghost-button" type="button" onClick={exportSummary}>
            Copy Summary
          </button>
          <button className="ghost-button" type="button" onClick={() => setView(view === "deck" ? "board" : "deck")}>
            {view === "deck" ? "Show Board" : "Sort Deck"}
          </button>
          <button className="ghost-button danger" type="button" onClick={resetBoard}>
            Reset
          </button>
        </div>
      </section>

      <section className="metrics" aria-label="Scope counts">
        {lanes.map((lane) => (
          <div className="metric" key={lane.id}>
            <span>{lane.title}</span>
            <strong>{totalByLane(lane.id)}</strong>
          </div>
        ))}
      </section>

      {view === "deck" ? (
        <section className="deck" aria-labelledby="deck-title">
          <div className="deck-stage">
            <div className="deck-progress">
              <p className="eyebrow">Feature {Math.min(completedCount + 1, features.length)} of {features.length}</p>
              <h2 id="deck-title">Sort one feature at a time</h2>
              <div className="progress-track" aria-label={`${completedCount} of ${features.length} features sorted`}>
                <div style={{ width: `${(completedCount / features.length) * 100}%` }} />
              </div>
            </div>

            {currentFeature ? (
              <article
                className={`decision-card${deckDrag ? " decision-card-dragging" : ""}`}
                style={deckDrag ? {
                  position: "fixed",
                  left: deckDrag.x - deckDrag.offsetX,
                  top: deckDrag.y - deckDrag.offsetY,
                  width: deckDrag.width,
                  zIndex: 1000,
                } : undefined}
                onPointerDown={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDeckDrag({
                    featureId: currentFeature.id,
                    x: event.clientX,
                    y: event.clientY,
                    offsetX: event.clientX - rect.left,
                    offsetY: event.clientY - rect.top,
                    width: rect.width,
                  });
                  setDraggingId(currentFeature.id);
                }}
              >
                <div className="card-topline">
                  <span className="area-pill">{currentFeature.area}</span>
                  <span className={`risk risk-${currentFeature.risk}`}>{currentFeature.risk}</span>
                </div>
                <h3>{currentFeature.title}</h3>
                <p>{currentFeature.detail}</p>
              </article>
            ) : (
              <div className="decision-card done-card">
                <h3>All sorted</h3>
                <p>The kanban board is ready for final review.</p>
                <button className="handoff-button" type="button" onClick={() => setView("board")}>Open Board</button>
              </div>
            )}
          </div>

          <div className="bucket-row" aria-label="Drop buckets">
            {lanes.map((lane) => (
              <button
                className={`bucket bucket-${lane.id}${activeBucket === lane.id ? " bucket-active" : ""}`}
                key={lane.id}
                type="button"
                data-lane={lane.id}
                onClick={() => currentFeature && sortFeature(currentFeature.id, lane.id)}
                onDragEnter={() => setActiveBucket(lane.id)}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setActiveBucket(lane.id);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setActiveBucket(null);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const featureId = event.dataTransfer.getData("text/plain") || draggingId || currentFeature?.id;
                  if (featureId) sortFeature(featureId, lane.id);
                  setActiveBucket(null);
                  setDraggingId(null);
                }}
              >
                <strong>{lane.title}</strong>
                <span>{lane.caption}</span>
              </button>
            ))}
          </div>
        </section>
      ) : (
      <section className="board" aria-label="Feature scope lanes">
        {lanes.map((lane) => {
          const laneFeatures = scopedFeatures.filter((feature) => featureLane(feature) === lane.id);
          return (
            <section
              className={`lane lane-${lane.id}`}
              key={lane.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const featureId = event.dataTransfer.getData("text/plain") || draggingId;
                if (featureId) moveFeature(featureId, lane.id);
                setDraggingId(null);
              }}
            >
              <header className="lane-header">
                <div>
                  <h2>{lane.title}</h2>
                  <p>{lane.caption}</p>
                </div>
                <span className="lane-count">{laneFeatures.length}</span>
              </header>

              <div className="card-stack">
                {laneFeatures.map((feature) => (
                  <FeatureCard
                    key={feature.id}
                    feature={feature}
                    currentLane={lane.id}
                    onDragStart={() => setDraggingId(feature.id)}
                    onDragEnd={() => setDraggingId(null)}
                    onMove={moveFeature}
                  />
                ))}
                {laneFeatures.length === 0 ? (
                  <div className="empty-lane">Drop features here</div>
                ) : null}
              </div>
            </section>
          );
        })}
      </section>
      )}

      <section className="handoff" aria-labelledby="handoff-title">
        <div>
          <p className="eyebrow">Ready to cut</p>
          <h2 id="handoff-title">Turn this board into a Codex prompt</h2>
          <p>
            Once the lanes feel right, copy a complete prompt that tells Codex what to keep,
            what to defer, and how to slim the app safely.
          </p>
        </div>
        <button className="handoff-button" type="button" onClick={copyImplementationPrompt}>
          Copy Slimming Prompt
        </button>
      </section>
    </main>
  );
}

function FeatureCard({
  feature,
  currentLane,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  feature: Feature;
  currentLane: LaneId;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (featureId: string, laneId: LaneId) => void;
}) {
  return (
    <article
      className="feature-card"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", feature.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      <div className="card-topline">
        <span className="area-pill">{feature.area}</span>
        <span className={`risk risk-${feature.risk}`}>{feature.risk}</span>
      </div>
      <h3>{feature.title}</h3>
      <p>{feature.detail}</p>
      <div className="move-row" aria-label={`Move ${feature.title}`}>
        {lanes.map((lane) => (
          <button
            key={lane.id}
            type="button"
            className={lane.id === currentLane ? "move-button active" : "move-button"}
            onClick={() => onMove(feature.id, lane.id)}
            aria-pressed={lane.id === currentLane}
          >
            {lane.title}
          </button>
        ))}
      </div>
    </article>
  );
}
