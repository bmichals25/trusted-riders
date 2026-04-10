import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  createChannel,
  generateRideId,
  loadRides,
  saveRides,
  type DispatchedRide,
  type DispatchMessage,
  type RideStatus,
  type TrackedDriver,
  type TransitType,
} from "./channel";

// -- Preset locations for quick testing --
const PRESETS = [
  {
    label: "Eleanor Rigby",
    passenger: "Eleanor Rigby",
    pickup: "123 Penny Lane",
    dropoff: "City Medical Center",
    pickupCoords: { latitude: 37.788, longitude: -122.408 },
    dropoffCoords: { latitude: 37.775, longitude: -122.42 },
    transit: "Wheelchair" as TransitType,
    trip: "Round-Trip" as const,
    notes: "Vision impaired in left eye. Requires steady arm assistance during boarding.",
    emergency: "Father McKenzie (555-0199)",
  },
  {
    label: "Sarah Jenkins",
    passenger: "Sarah Jenkins",
    pickup: "45 Oak Street",
    dropoff: "Bay Physical Therapy",
    pickupCoords: { latitude: 37.782, longitude: -122.413 },
    dropoffCoords: { latitude: 37.769, longitude: -122.429 },
    transit: "Sedan" as TransitType,
    trip: "One-Way" as const,
    notes: "Recovering from hip surgery. Needs extra time getting in and out.",
    emergency: "David Jenkins (555-0342)",
  },
  {
    label: "Martin Lewis",
    passenger: "Martin Lewis",
    pickup: "890 Mission Bay Blvd",
    dropoff: "UCSF Cardiology",
    pickupCoords: { latitude: 37.771, longitude: -122.393 },
    dropoffCoords: { latitude: 37.763, longitude: -122.458 },
    transit: "Wheelchair" as TransitType,
    trip: "Round-Trip" as const,
    notes: "Oxygen tank secured in wheelchair mount. Do not disconnect.",
    emergency: "Patricia Lewis (555-0718)",
  },
  {
    label: "Random Ride",
    passenger: "",
    pickup: "",
    dropoff: "",
    pickupCoords: { latitude: 37.78, longitude: -122.41 },
    dropoffCoords: { latitude: 37.77, longitude: -122.43 },
    transit: "Sedan" as TransitType,
    trip: "One-Way" as const,
    notes: "",
    emergency: "",
  },
];

const RANDOM_FIRST = ["Alice", "Bob", "Carlos", "Diana", "Eugene", "Fiona", "George", "Helen", "Ivan", "Julia"];
const RANDOM_LAST = ["Park", "Nguyen", "Okafor", "Schmidt", "Rivera", "Chen", "Patel", "Kim", "Silva", "Dubois"];
const RANDOM_STREETS = ["Market St", "Valencia St", "Divisadero St", "Fulton St", "Geary Blvd", "Irving St", "Clement St", "Hayes St"];
const RANDOM_FACILITIES = ["Kaiser Permanente", "Sutter Health Clinic", "CPMC Davies", "Zuckerberg SF General", "VA Medical Center"];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomRide(): Omit<typeof PRESETS[0], "label"> {
  const first = randomFrom(RANDOM_FIRST);
  const last = randomFrom(RANDOM_LAST);
  return {
    passenger: `${first} ${last}`,
    pickup: `${Math.floor(Math.random() * 900 + 100)} ${randomFrom(RANDOM_STREETS)}`,
    dropoff: randomFrom(RANDOM_FACILITIES),
    pickupCoords: { latitude: 37.77 + Math.random() * 0.03, longitude: -122.43 + Math.random() * 0.03 },
    dropoffCoords: { latitude: 37.76 + Math.random() * 0.03, longitude: -122.44 + Math.random() * 0.03 },
    transit: randomFrom(["Sedan", "Wheelchair", "Stretcher", "Ambulatory"] as TransitType[]),
    trip: randomFrom<"One-Way" | "Round-Trip">(["One-Way", "Round-Trip"]),
    notes: "",
    emergency: `${randomFrom(RANDOM_FIRST)} ${randomFrom(RANDOM_LAST)} (555-${String(Math.floor(Math.random() * 9000 + 1000))})`,
  };
}

// -- Status colors --
const STATUS_COLORS: Record<RideStatus, { bg: string; text: string }> = {
  pending: { bg: "#FEF3C7", text: "#B45309" },
  accepted: { bg: "#DBEAFE", text: "#1D4ED8" },
  en_route: { bg: "#EDE9FE", text: "#6D28D9" },
  picked_up: { bg: "#E0E7FF", text: "#4338CA" },
  in_transit: { bg: "#EDE9FE", text: "#6D28D9" },
  completed: { bg: "#DCFCE7", text: "#15803D" },
  cancelled: { bg: "#FEE2E2", text: "#B91C1C" },
};

// ================================================================
// App
// ================================================================

export function App() {
  const [rides, setRides] = useState<DispatchedRide[]>(loadRides);
  const [formOpen, setFormOpen] = useState(false);
  const [trackers, setTrackers] = useState<TrackedDriver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [mapExpanded, setMapExpanded] = useState(true);
  const channelRef = useRef<ReturnType<typeof createChannel> | null>(null);

  // Connect to broadcast channel
  useEffect(() => {
    const ch = createChannel((msg: DispatchMessage) => {
      if (msg.type === "tracker_list") {
        setTrackers(msg.trackers);
      } else if (msg.type === "driver_ack" || msg.type === "status_update") {
        setRides((prev) => {
          const next = prev.map((r) =>
            r.id === (msg.type === "driver_ack" ? msg.rideId : msg.rideId)
              ? { ...r, status: msg.status }
              : r
          );
          saveRides(next);
          return next;
        });
      }
    });
    channelRef.current = ch;
    return () => ch.close();
  }, []);

  const dispatchRide = useCallback((ride: DispatchedRide) => {
    setRides((prev) => {
      const next = [ride, ...prev];
      saveRides(next);
      return next;
    });
    channelRef.current?.send({ type: "ride_dispatched", ride });
  }, []);

  const cancelRide = useCallback((id: string) => {
    setRides((prev) => {
      const next = prev.map((r) =>
        r.id === id ? { ...r, status: "cancelled" as RideStatus } : r
      );
      saveRides(next);
      return next;
    });
    channelRef.current?.send({ type: "ride_cancelled", rideId: id });
  }, []);

  const deleteRide = useCallback((id: string) => {
    setRides((prev) => {
      const next = prev.filter((r) => r.id !== id);
      saveRides(next);
      return next;
    });
    channelRef.current?.send({ type: "ride_deleted", rideId: id });
  }, []);

  const updateRide = useCallback((updated: DispatchedRide) => {
    setRides((prev) => {
      const next = prev.map((r) => (r.id === updated.id ? updated : r));
      saveRides(next);
      return next;
    });
    channelRef.current?.send({ type: "ride_updated", ride: updated });
  }, []);

  const releaseRide = useCallback((id: string) => {
    setRides((prev) => {
      const next = prev.map((r) =>
        r.id === id ? { ...r, status: "en_route" as RideStatus } : r
      );
      saveRides(next);
      return next;
    });
    channelRef.current?.send({ type: "ride_released", rideId: id });
  }, []);

  const clearCompleted = useCallback(() => {
    setRides((prev) => {
      const next = prev.filter((r) => r.status !== "completed" && r.status !== "cancelled");
      saveRides(next);
      return next;
    });
  }, []);

  const quickDispatch = useCallback((presetIndex: number) => {
    const preset = presetIndex === 3 ? randomRide() : PRESETS[presetIndex];
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const date = now.toISOString().split("T")[0];
    const ride: DispatchedRide = {
      id: generateRideId(),
      passengerName: preset.passenger || randomRide().passenger,
      pickupAddress: preset.pickup || randomRide().pickup,
      dropoffAddress: preset.dropoff || randomRide().dropoff,
      pickupCoords: preset.pickupCoords,
      dropoffCoords: preset.dropoffCoords,
      scheduledDate: date,
      scheduledTime: time,
      transitType: preset.transit,
      tripType: preset.trip,
      notes: preset.notes,
      emergencyContact: preset.emergency,
      status: "pending",
      createdAt: Date.now(),
    };
    dispatchRide(ride);
  }, [dispatchRide]);

  const activeRides = rides.filter((r) => r.status !== "completed" && r.status !== "cancelled");
  const pastRides = rides.filter((r) => r.status === "completed" || r.status === "cancelled");

  return (
    <div style={styles.shell}>
      <style>{globalCSS}</style>

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={styles.logoMark}>TR</div>
            <div>
              <h1 style={styles.headerTitle}>Dispatch Console</h1>
              <p style={styles.headerSub}>TrustedRiders Operations</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={styles.connectionDot} />
            <span style={styles.connectionLabel}>Live</span>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        {/* Live Fleet Map */}
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={styles.sectionLabel}>
              Live Fleet
              {trackers.filter((t) => t.status === "tracking").length > 0 && (
                <span style={{ ...styles.countBadge, backgroundColor: "#16A34A" }}>
                  {trackers.filter((t) => t.status === "tracking").length} active
                </span>
              )}
            </h2>
            <button
              style={{ ...styles.clearBtn, fontSize: 10 }}
              onClick={() => setMapExpanded(!mapExpanded)}
            >
              {mapExpanded ? "Collapse" : "Expand"}
            </button>
          </div>
          {mapExpanded && (
            <div style={{ display: "flex", gap: 12, minHeight: 380 }}>
              <div style={{ flex: 1, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
                <LiveMap trackers={trackers} selectedDriver={selectedDriver} onSelectDriver={setSelectedDriver} />
              </div>
              <div style={{ width: 260, flexShrink: 0 }}>
                <DriverPanel trackers={trackers} selectedDriver={selectedDriver} onSelectDriver={setSelectedDriver} />
              </div>
            </div>
          )}
          {!mapExpanded && trackers.length === 0 && (
            <div style={styles.emptyState}>
              <p style={styles.emptyTitle}>No drivers connected</p>
              <p style={styles.emptyBody}>Driver locations will appear here when they connect</p>
            </div>
          )}
        </section>

        {/* Quick dispatch strip */}
        <section style={styles.quickSection}>
          <h2 style={styles.sectionLabel}>Quick Dispatch</h2>
          <div style={styles.quickGrid}>
            {PRESETS.map((p, i) => (
              <button
                key={i}
                style={styles.quickCard}
                onClick={() => quickDispatch(i)}
                onMouseDown={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "scale(0.97)";
                }}
                onMouseUp={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                }}
              >
                <div style={styles.quickIcon}>
                  {i === 3 ? "?" : p.label.charAt(0)}
                </div>
                <div style={styles.quickLabel}>{p.label}</div>
                <div style={styles.quickMeta}>
                  {i === 3 ? "Generate random" : `${p.transit} / ${p.trip}`}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Custom dispatch form */}
        <section style={styles.formSection}>
          <button
            style={styles.newRideBtn}
            onClick={() => setFormOpen(!formOpen)}
          >
            {formOpen ? "Close Form" : "+ Custom Ride"}
          </button>
          {formOpen && (
            <DispatchForm
              onDispatch={(ride) => {
                dispatchRide(ride);
                setFormOpen(false);
              }}
            />
          )}
        </section>

        {/* Active rides */}
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={styles.sectionLabel}>
              Active Rides
              {activeRides.length > 0 && (
                <span style={styles.countBadge}>{activeRides.length}</span>
              )}
            </h2>
          </div>
          {activeRides.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={styles.emptyTitle}>No active rides</p>
              <p style={styles.emptyBody}>Use Quick Dispatch above to send a test ride</p>
            </div>
          ) : (
            <div style={styles.rideList}>
              {activeRides.map((ride) => (
                <RideCard key={ride.id} ride={ride} onCancel={cancelRide} onRelease={releaseRide} onDelete={deleteRide} onUpdate={updateRide} />
              ))}
            </div>
          )}
        </section>

        {/* Past rides */}
        {pastRides.length > 0 && (
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ ...styles.sectionLabel, opacity: 0.5 }}>Past Rides</h2>
              <button style={styles.clearBtn} onClick={clearCompleted}>Clear</button>
            </div>
            <div style={styles.rideList}>
              {pastRides.slice(0, 10).map((ride) => (
                <RideCard key={ride.id} ride={ride} onCancel={cancelRide} onRelease={releaseRide} onDelete={deleteRide} onUpdate={updateRide} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

// ================================================================
// Ride Card
// ================================================================

function RideCard({
  ride,
  onCancel,
  onRelease,
  onDelete,
  onUpdate,
}: {
  ride: DispatchedRide;
  onCancel: (id: string) => void;
  onRelease: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (ride: DispatchedRide) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sc = STATUS_COLORS[ride.status];
  const isFinished = ride.status === "completed" || ride.status === "cancelled";

  if (editing) {
    return (
      <EditRideForm
        ride={ride}
        onSave={(updated) => {
          onUpdate(updated);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div style={styles.rideCard}>
      <div style={styles.rideHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={styles.rideId}>{ride.id}</span>
          <span style={{ ...styles.statusBadge, backgroundColor: sc.bg, color: sc.text }}>
            {ride.status.replace("_", " ")}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={styles.rideTime}>{ride.scheduledDate} {ride.scheduledTime}</span>
          {!isFinished && (
            <button style={styles.editBtn} onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
        </div>
      </div>

      <div style={styles.rideName}>{ride.passengerName}</div>
      <div style={styles.rideType}>{ride.transitType} / {ride.tripType}</div>

      <div style={styles.routeRow}>
        <div style={styles.routeDot("#2563EB")} />
        <span style={styles.routeAddr}>{ride.pickupAddress}</span>
      </div>
      <div style={styles.routeRow}>
        <div style={styles.routeDot("#16A34A")} />
        <span style={styles.routeAddr}>{ride.dropoffAddress}</span>
      </div>

      {ride.notes && <div style={styles.rideNotes}>{ride.notes}</div>}

      <div style={styles.rideActions}>
        {ride.status === "pending" && (
          <button style={styles.cancelBtn} onClick={() => onCancel(ride.id)}>
            Cancel Ride
          </button>
        )}
        {ride.status === "accepted" && (
          <button style={styles.startBtn} onClick={() => onRelease(ride.id)}>
            Start Ride
          </button>
        )}
        {confirmDelete ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#FCA5A5", fontWeight: 600 }}>Delete this ride?</span>
            <button style={styles.deleteConfirmBtn} onClick={() => onDelete(ride.id)}>
              Yes, Delete
            </button>
            <button style={styles.deleteNevermindBtn} onClick={() => setConfirmDelete(false)}>
              No
            </button>
          </div>
        ) : (
          <button style={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ================================================================
// Edit Ride Form
// ================================================================

function EditRideForm({
  ride,
  onSave,
  onCancel,
}: {
  ride: DispatchedRide;
  onSave: (ride: DispatchedRide) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    passenger: ride.passengerName,
    pickup: ride.pickupAddress,
    dropoff: ride.dropoffAddress,
    transit: ride.transitType,
    trip: ride.tripType,
    notes: ride.notes,
    emergency: ride.emergencyContact,
    date: ride.scheduledDate,
    time: ride.scheduledTime,
  });

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.passenger || !form.pickup || !form.dropoff) return;
    onSave({
      ...ride,
      passengerName: form.passenger,
      pickupAddress: form.pickup,
      dropoffAddress: form.dropoff,
      scheduledDate: form.date,
      scheduledTime: form.time,
      transitType: form.transit as TransitType,
      tripType: form.trip as "One-Way" | "Round-Trip",
      notes: form.notes,
      emergencyContact: form.emergency,
    });
  };

  return (
    <form onSubmit={submit} style={{ ...styles.rideCard, border: `1px solid ${C.accent}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: C.accent, textTransform: "uppercase" as const, letterSpacing: 1.2 }}>
          Editing {ride.id}
        </span>
      </div>
      <div style={styles.formGrid}>
        <Field label="Passenger Name" required>
          <input style={styles.input} value={form.passenger} onChange={(e) => set("passenger", e.target.value)} />
        </Field>
        <Field label="Scheduled Date">
          <input style={styles.input} type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
        </Field>
        <Field label="Scheduled Time">
          <input style={styles.input} type="time" value={form.time} onChange={(e) => set("time", e.target.value)} />
        </Field>
        <Field label="Pickup Address" required>
          <input style={styles.input} value={form.pickup} onChange={(e) => set("pickup", e.target.value)} />
        </Field>
        <Field label="Drop-off Address" required>
          <input style={styles.input} value={form.dropoff} onChange={(e) => set("dropoff", e.target.value)} />
        </Field>
        <Field label="Transit Type">
          <select style={styles.input} value={form.transit} onChange={(e) => set("transit", e.target.value)}>
            <option>Sedan</option>
            <option>Wheelchair</option>
            <option>Stretcher</option>
            <option>Ambulatory</option>
          </select>
        </Field>
        <Field label="Trip Type">
          <select style={styles.input} value={form.trip} onChange={(e) => set("trip", e.target.value)}>
            <option>One-Way</option>
            <option>Round-Trip</option>
          </select>
        </Field>
        <Field label="Medical / Care Notes" full>
          <textarea style={{ ...styles.input, minHeight: 64, resize: "vertical" as const }} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        <Field label="Emergency Contact">
          <input style={styles.input} value={form.emergency} onChange={(e) => set("emergency", e.target.value)} />
        </Field>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button type="button" style={styles.editCancelBtn} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" style={styles.editSaveBtn}>
          Save Changes
        </button>
      </div>
    </form>
  );
}

// ================================================================
// Custom Dispatch Form
// ================================================================

function DispatchForm({ onDispatch }: { onDispatch: (ride: DispatchedRide) => void }) {
  const [form, setForm] = useState({
    passenger: "",
    pickup: "",
    dropoff: "",
    transit: "Sedan" as TransitType,
    trip: "One-Way" as "One-Way" | "Round-Trip",
    notes: "",
    emergency: "",
    date: "",
    time: "",
  });

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.passenger || !form.pickup || !form.dropoff) return;
    const now = new Date();
    onDispatch({
      id: generateRideId(),
      passengerName: form.passenger,
      pickupAddress: form.pickup,
      dropoffAddress: form.dropoff,
      pickupCoords: { latitude: 37.77 + Math.random() * 0.03, longitude: -122.43 + Math.random() * 0.03 },
      dropoffCoords: { latitude: 37.76 + Math.random() * 0.03, longitude: -122.44 + Math.random() * 0.03 },
      scheduledDate: form.date || now.toISOString().split("T")[0],
      scheduledTime: form.time || `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      transitType: form.transit,
      tripType: form.trip,
      notes: form.notes,
      emergencyContact: form.emergency,
      status: "pending",
      createdAt: Date.now(),
    });
  };

  return (
    <form onSubmit={submit} style={styles.form}>
      <div style={styles.formGrid}>
        <Field label="Passenger Name" required>
          <input style={styles.input} value={form.passenger} onChange={(e) => set("passenger", e.target.value)} placeholder="Full name" />
        </Field>
        <Field label="Scheduled Time">
          <input style={styles.input} type="time" value={form.time} onChange={(e) => set("time", e.target.value)} />
        </Field>
        <Field label="Pickup Address" required>
          <input style={styles.input} value={form.pickup} onChange={(e) => set("pickup", e.target.value)} placeholder="Street address" />
        </Field>
        <Field label="Drop-off Address" required>
          <input style={styles.input} value={form.dropoff} onChange={(e) => set("dropoff", e.target.value)} placeholder="Facility or address" />
        </Field>
        <Field label="Transit Type">
          <select style={styles.input} value={form.transit} onChange={(e) => set("transit", e.target.value)}>
            <option>Sedan</option>
            <option>Wheelchair</option>
            <option>Stretcher</option>
            <option>Ambulatory</option>
          </select>
        </Field>
        <Field label="Trip Type">
          <select style={styles.input} value={form.trip} onChange={(e) => set("trip", e.target.value)}>
            <option>One-Way</option>
            <option>Round-Trip</option>
          </select>
        </Field>
        <Field label="Medical / Care Notes" full>
          <textarea style={{ ...styles.input, minHeight: 64, resize: "vertical" as const }} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Any special instructions for the driver" />
        </Field>
        <Field label="Emergency Contact">
          <input style={styles.input} value={form.emergency} onChange={(e) => set("emergency", e.target.value)} placeholder="Name (555-0000)" />
        </Field>
      </div>
      <button type="submit" style={styles.dispatchBtn}>
        Dispatch Ride
      </button>
    </form>
  );
}

function Field({ label, required, full, children }: { label: string; required?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ ...styles.fieldWrap, gridColumn: full ? "1 / -1" : undefined }}>
      <span style={styles.fieldLabel}>
        {label}
        {required && <span style={{ color: "#DC2626" }}> *</span>}
      </span>
      {children}
    </label>
  );
}

// ================================================================
// Live Map (Leaflet) — repurposed from TR_GPS MapComponent
// ================================================================

function LiveMap({
  trackers,
  selectedDriver,
  onSelectDriver,
}: {
  trackers: TrackedDriver[];
  selectedDriver: string | null;
  onSelectDriver: (id: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [37.778, -122.415],
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when trackers change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(trackers.map((t) => t.driverId));

    // Remove markers for trackers no longer present
    for (const [id, marker] of markersRef.current) {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    const activeTrackers = trackers.filter((t) => t.status === "tracking");

    for (const tracker of trackers) {
      const isActive = tracker.status === "tracking";
      const isSelected = tracker.driverId === selectedDriver;
      const color = isActive ? "#2563EB" : "#4A5568";
      const radius = isSelected ? 10 : 7;

      const existing = markersRef.current.get(tracker.driverId);
      if (existing) {
        existing.setLatLng([tracker.lat, tracker.lon]);
        existing.setStyle({
          color: isSelected ? "#fff" : color,
          fillColor: color,
          radius,
          weight: isSelected ? 3 : 2,
        });
      } else {
        const marker = L.circleMarker([tracker.lat, tracker.lon], {
          radius,
          fillColor: color,
          color: isSelected ? "#fff" : color,
          weight: isSelected ? 3 : 2,
          fillOpacity: isActive ? 0.9 : 0.4,
        })
          .addTo(map)
          .bindTooltip(`${tracker.name}${tracker.ride_id ? ` — Ride #${tracker.ride_id}` : ""}`, {
            permanent: false,
            direction: "top",
            offset: [0, -10],
            className: "driver-tooltip",
          })
          .on("click", () => onSelectDriver(tracker.driverId));

        markersRef.current.set(tracker.driverId, marker);
      }
    }

    // Fit bounds to active trackers
    if (activeTrackers.length > 0 && !selectedDriver) {
      const bounds = L.latLngBounds(activeTrackers.map((t) => [t.lat, t.lon] as [number, number]));
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    }

    // Center on selected driver
    if (selectedDriver) {
      const sel = trackers.find((t) => t.driverId === selectedDriver);
      if (sel) {
        map.setView([sel.lat, sel.lon], Math.max(map.getZoom(), 14));
      }
    }
  }, [trackers, selectedDriver, onSelectDriver]);

  return (
    <>
      <style>{`
        .driver-tooltip {
          background: ${C.surface} !important;
          color: ${C.text} !important;
          border: 1px solid ${C.border} !important;
          border-radius: 6px !important;
          font-family: 'DM Sans', sans-serif !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          padding: 4px 10px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
        }
        .driver-tooltip::before {
          border-top-color: ${C.border} !important;
        }
      `}</style>
      <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: 380, background: C.bg }} />
    </>
  );
}

// ================================================================
// Driver Panel — shows connected drivers
// ================================================================

function DriverPanel({
  trackers,
  selectedDriver,
  onSelectDriver,
}: {
  trackers: TrackedDriver[];
  selectedDriver: string | null;
  onSelectDriver: (id: string | null) => void;
}) {
  const active = trackers.filter((t) => t.status === "tracking");
  const offline = trackers.filter((t) => t.status === "offline");

  function timeAgo(ts: number) {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 10) return "just now";
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    return `${Math.floor(sec / 3600)}h ago`;
  }

  return (
    <div style={{
      backgroundColor: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: 14,
      height: "100%",
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      <div style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 2, color: C.textMuted }}>
        Drivers
      </div>

      {trackers.length === 0 && (
        <div style={{ fontSize: 12, color: C.textFaint, textAlign: "center", padding: "32px 8px" }}>
          No drivers connected
        </div>
      )}

      {active.map((t) => (
        <button
          key={t.driverId}
          onClick={() => onSelectDriver(selectedDriver === t.driverId ? null : t.driverId)}
          style={{
            backgroundColor: selectedDriver === t.driverId ? C.accentSoft : C.surfaceRaised,
            border: `1px solid ${selectedDriver === t.driverId ? C.accent : C.border}`,
            borderRadius: 8,
            padding: "10px 12px",
            cursor: "pointer",
            textAlign: "left",
            fontFamily: "inherit",
            color: C.text,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            transition: "border-color 120ms",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: "#16A34A",
              boxShadow: "0 0 6px rgba(22, 163, 74, 0.5)",
            }} />
            <span style={{ fontSize: 13, fontWeight: 800 }}>{t.name}</span>
          </div>
          <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>
            {t.speed != null && t.speed > 0
              ? `${(t.speed * 2.237).toFixed(0)} mph`
              : "Stationary"
            }
            {" · "}{timeAgo(t.lastUpdate)}
          </div>
          <div style={{ fontSize: 10, color: C.textFaint, fontWeight: 600 }}>
            GPS: {t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : "—"}
          </div>
          {t.ride_id ? (
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#A78BFA",
              backgroundColor: "rgba(167, 139, 250, 0.1)",
              padding: "2px 8px",
              borderRadius: 4,
              display: "inline-block",
            }}>
              Ride #{t.ride_id}
            </div>
          ) : (
            <div style={{ fontSize: 10, color: C.textFaint, fontWeight: 600, fontStyle: "italic" }}>
              No active ride
            </div>
          )}
          {t.battery != null && (
            <div style={{
              fontSize: 10,
              color: t.battery < 20 ? "#FCA5A5" : C.textFaint,
              fontWeight: 700,
            }}>
              Battery: {t.battery}%
            </div>
          )}
        </button>
      ))}

      {offline.length > 0 && (
        <>
          <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.5, color: C.textFaint, marginTop: 4 }}>
            Offline
          </div>
          {offline.map((t) => (
            <div
              key={t.driverId}
              style={{
                backgroundColor: C.surfaceRaised,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: "8px 12px",
                opacity: 0.5,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.textFaint }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted }}>{t.name}</span>
              </div>
              <div style={{ fontSize: 10, color: C.textFaint, fontWeight: 600, marginTop: 4 }}>
                Last seen {timeAgo(t.lastUpdate)}
                {t.ride_id ? ` · Ride #${t.ride_id}` : ""}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ================================================================
// Styles
// ================================================================

const C = {
  bg: "#0B0F1A",
  surface: "#141926",
  surfaceRaised: "#1C2333",
  border: "#252D3D",
  text: "#E8ECF4",
  textMuted: "#7B8BA5",
  textFaint: "#4A5568",
  accent: "#2563EB",
  accentSoft: "rgba(37, 99, 235, 0.12)",
};

const styles = {
  shell: {
    minHeight: "100vh",
    backgroundColor: C.bg,
    color: C.text,
    fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
  } as React.CSSProperties,

  header: {
    borderBottom: `1px solid ${C.border}`,
    position: "sticky" as const,
    top: 0,
    backgroundColor: C.bg,
    zIndex: 10,
    backdropFilter: "blur(12px)",
  } as React.CSSProperties,

  headerInner: {
    maxWidth: 960,
    margin: "0 auto",
    padding: "16px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,

  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: C.accent,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 900,
    color: "#fff",
    letterSpacing: 0.5,
  } as React.CSSProperties,

  headerTitle: {
    fontSize: 16,
    fontWeight: 800,
    margin: 0,
    letterSpacing: -0.3,
  } as React.CSSProperties,

  headerSub: {
    fontSize: 11,
    fontWeight: 600,
    color: C.textMuted,
    margin: 0,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  } as React.CSSProperties,

  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#16A34A",
    boxShadow: "0 0 6px rgba(22, 163, 74, 0.5)",
  } as React.CSSProperties,

  connectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#16A34A",
    textTransform: "uppercase" as const,
    letterSpacing: 1.2,
  } as React.CSSProperties,

  main: {
    maxWidth: 960,
    margin: "0 auto",
    padding: "32px 24px 64px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 40,
  } as React.CSSProperties,

  quickSection: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 14,
  } as React.CSSProperties,

  sectionLabel: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase" as const,
    letterSpacing: 2,
    color: C.textMuted,
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: 8,
  } as React.CSSProperties,

  countBadge: {
    fontSize: 10,
    fontWeight: 800,
    backgroundColor: C.accent,
    color: "#fff",
    borderRadius: 4,
    padding: "2px 6px",
    letterSpacing: 0,
  } as React.CSSProperties,

  quickGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 10,
  } as React.CSSProperties,

  quickCard: {
    backgroundColor: C.surfaceRaised,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: "16px 18px",
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "transform 120ms, border-color 120ms",
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    color: C.text,
    fontFamily: "inherit",
  } as React.CSSProperties,

  quickIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: C.accentSoft,
    color: C.accent,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 900,
  } as React.CSSProperties,

  quickLabel: {
    fontSize: 14,
    fontWeight: 800,
  } as React.CSSProperties,

  quickMeta: {
    fontSize: 11,
    fontWeight: 600,
    color: C.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  } as React.CSSProperties,

  formSection: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  } as React.CSSProperties,

  newRideBtn: {
    alignSelf: "flex-start" as const,
    backgroundColor: "transparent",
    border: `1px dashed ${C.border}`,
    borderRadius: 8,
    padding: "10px 20px",
    color: C.textMuted,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    transition: "border-color 120ms, color 120ms",
  } as React.CSSProperties,

  form: {
    backgroundColor: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: 24,
    display: "flex",
    flexDirection: "column" as const,
    gap: 20,
  } as React.CSSProperties,

  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  } as React.CSSProperties,

  fieldWrap: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  } as React.CSSProperties,

  fieldLabel: {
    fontSize: 10,
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: 1.2,
    color: C.textMuted,
  } as React.CSSProperties,

  input: {
    backgroundColor: C.surfaceRaised,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: "10px 14px",
    color: C.text,
    fontSize: 14,
    fontWeight: 500,
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color 120ms",
    width: "100%",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,

  dispatchBtn: {
    alignSelf: "flex-end" as const,
    backgroundColor: C.accent,
    border: "none",
    borderRadius: 8,
    padding: "12px 32px",
    color: "#fff",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    fontFamily: "inherit",
    textTransform: "uppercase" as const,
    letterSpacing: 1.5,
    transition: "transform 100ms",
  } as React.CSSProperties,

  rideList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  } as React.CSSProperties,

  rideCard: {
    backgroundColor: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: "18px 20px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  } as React.CSSProperties,

  rideHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,

  rideId: {
    fontSize: 11,
    fontWeight: 800,
    color: C.textFaint,
    fontVariantNumeric: "tabular-nums",
  } as React.CSSProperties,

  statusBadge: {
    fontSize: 9,
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    padding: "3px 8px",
    borderRadius: 4,
  } as React.CSSProperties,

  rideTime: {
    fontSize: 13,
    fontWeight: 800,
    color: C.accent,
    fontVariantNumeric: "tabular-nums",
  } as React.CSSProperties,

  rideName: {
    fontSize: 20,
    fontWeight: 900,
    letterSpacing: -0.3,
  } as React.CSSProperties,

  rideType: {
    fontSize: 11,
    fontWeight: 700,
    color: C.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
  } as React.CSSProperties,

  routeRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  } as React.CSSProperties,

  routeDot: (color: string) => ({
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color,
    flexShrink: 0,
  }) as React.CSSProperties,

  routeAddr: {
    fontSize: 13,
    fontWeight: 600,
    color: C.textMuted,
  } as React.CSSProperties,

  rideNotes: {
    fontSize: 12,
    fontWeight: 500,
    color: C.textFaint,
    fontStyle: "italic" as const,
    borderTop: `1px solid ${C.border}`,
    paddingTop: 10,
  } as React.CSSProperties,

  startBtn: {
    alignSelf: "flex-start" as const,
    backgroundColor: "rgba(37, 99, 235, 0.15)",
    border: "none",
    borderRadius: 6,
    padding: "10px 20px",
    color: "#60A5FA",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "inherit",
    textTransform: "uppercase" as const,
    letterSpacing: 1.2,
  } as React.CSSProperties,

  cancelBtn: {
    alignSelf: "flex-start" as const,
    backgroundColor: "rgba(220, 38, 38, 0.1)",
    border: "none",
    borderRadius: 6,
    padding: "8px 16px",
    color: "#FCA5A5",
    fontSize: 10,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "inherit",
    textTransform: "uppercase" as const,
    letterSpacing: 1.2,
  } as React.CSSProperties,

  clearBtn: {
    backgroundColor: "transparent",
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    padding: "6px 14px",
    color: C.textFaint,
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  } as React.CSSProperties,

  emptyState: {
    backgroundColor: C.surface,
    border: `1px dashed ${C.border}`,
    borderRadius: 10,
    padding: "48px 24px",
    textAlign: "center" as const,
  } as React.CSSProperties,

  emptyTitle: {
    fontSize: 14,
    fontWeight: 800,
    margin: "0 0 6px",
  } as React.CSSProperties,

  emptyBody: {
    fontSize: 12,
    fontWeight: 500,
    color: C.textMuted,
    margin: 0,
  } as React.CSSProperties,

  rideActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  editBtn: {
    backgroundColor: "rgba(37, 99, 235, 0.1)",
    border: "none",
    borderRadius: 4,
    padding: "4px 10px",
    color: "#60A5FA",
    fontSize: 10,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "inherit",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  } as React.CSSProperties,

  deleteBtn: {
    backgroundColor: "transparent",
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    padding: "6px 14px",
    color: C.textFaint,
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginLeft: "auto",
  } as React.CSSProperties,

  deleteConfirmBtn: {
    backgroundColor: "rgba(220, 38, 38, 0.15)",
    border: "none",
    borderRadius: 6,
    padding: "6px 14px",
    color: "#FCA5A5",
    fontSize: 10,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "inherit",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  } as React.CSSProperties,

  deleteNevermindBtn: {
    backgroundColor: "transparent",
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    padding: "6px 14px",
    color: C.textMuted,
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  } as React.CSSProperties,

  editCancelBtn: {
    backgroundColor: "transparent",
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: "10px 24px",
    color: C.textMuted,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  } as React.CSSProperties,

  editSaveBtn: {
    backgroundColor: C.accent,
    border: "none",
    borderRadius: 8,
    padding: "10px 24px",
    color: "#fff",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    fontFamily: "inherit",
    textTransform: "uppercase" as const,
    letterSpacing: 1.5,
  } as React.CSSProperties,
} as const;

const globalCSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; }
  body { margin: 0; -webkit-font-smoothing: antialiased; }
  input:focus, select:focus, textarea:focus {
    border-color: ${C.accent} !important;
    box-shadow: 0 0 0 2px ${C.accentSoft};
  }
  button:hover { opacity: 0.92; }
  .quickCard:hover { border-color: ${C.accent} !important; }
  ::selection { background: ${C.accentSoft}; color: ${C.text}; }
  select { appearance: none; }
  @media (max-width: 600px) {
    .formGrid { grid-template-columns: 1fr !important; }
  }
`;
