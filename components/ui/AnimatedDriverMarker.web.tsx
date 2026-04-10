import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { colors } from "@/lib/theme";

type Props = {
  latitude: number;
  longitude: number;
  heading: number | null;
};

function makeDotIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="10" fill="rgba(37,99,235,0.15)"/>
    <circle cx="10" cy="10" r="6" fill="${colors.blue}" stroke="white" stroke-width="2"/>
  </svg>`;
  return L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

// Inner component that uses useMap (must be inside MapContainer)
function DriverMarkerInner({ latitude, longitude }: Props) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const marker = L.marker([latitude, longitude], { icon: makeDotIcon() }).addTo(map);
    markerRef.current = marker;
    return () => { marker.remove(); };
  }, [map]);

  useEffect(() => {
    markerRef.current?.setLatLng([latitude, longitude]);
  }, [latitude, longitude]);

  return null;
}

export function AnimatedDriverMarker(props: Props) {
  // This component must be rendered inside a MapContainer (via Map.web.tsx)
  // It uses useMap() internally
  return <DriverMarkerInner {...props} />;
}
