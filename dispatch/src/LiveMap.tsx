import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { TrackedDriver } from "./channel";

const C = {
  bg: "#0B0F1A",
  surface: "#141926",
  border: "#252D3D",
  text: "#E8ECF4",
};

export default function LiveMap({
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

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [37.778, -122.415],
      zoom: 13,
      zoomControl: false,
      attributionControl: true,
    });

    // Carto dark_all now watermarks "API KEY REQUIRED". Use OSM — no key, attribution on.
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(trackers.map((t) => t.driverId));

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

    if (activeTrackers.length > 0 && !selectedDriver) {
      const bounds = L.latLngBounds(activeTrackers.map((t) => [t.lat, t.lon] as [number, number]));
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    }

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
