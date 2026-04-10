import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import {
  MapContainer,
  TileLayer,
  Marker as LeafletMarker,
  Polyline as LeafletPolyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ── Types matching react-native-maps API ──

type LatLng = { latitude: number; longitude: number };

type Region = LatLng & {
  latitudeDelta: number;
  longitudeDelta: number;
};

type Camera = {
  center?: LatLng;
  zoom?: number;
  heading?: number;
};

type EdgePadding = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

type MapViewProps = {
  style?: ViewStyle;
  initialRegion?: Region;
  region?: Region;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  pitchEnabled?: boolean;
  rotateEnabled?: boolean;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  pointerEvents?: string;
  children?: React.ReactNode;
};

type MarkerProps = {
  coordinate: LatLng;
  title?: string;
  pinColor?: string;
  anchor?: { x: number; y: number };
  tracksViewChanges?: boolean;
  children?: React.ReactNode;
};

type PolylineProps = {
  coordinates: LatLng[];
  strokeColor?: string;
  strokeWidth?: number;
};

// ── Helpers ──

function toLatLng(coord: LatLng): [number, number] {
  return [coord.latitude, coord.longitude];
}

function regionToZoom(latDelta: number): number {
  return Math.round(Math.log2(360 / latDelta));
}

// Fix default Leaflet marker icon path issue in bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function makeColoredIcon(color: string) {
  // Use a simple colored circle SVG as marker for colored pins
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
    <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 2.4.7 4.7 1.9 6.6L12.5 41l10.6-21.9c1.2-1.9 1.9-4.2 1.9-6.6C25 5.6 19.4 0 12.5 0z" fill="${color}"/>
    <circle cx="12.5" cy="12.5" r="5" fill="white"/>
  </svg>`;
  return L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [0, -41],
  });
}

// ── RegionController: syncs the `region` prop to the Leaflet map ──

function RegionController({
  region,
  scrollEnabled,
  zoomEnabled,
}: {
  region?: Region;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (region) {
      map.setView(toLatLng(region), regionToZoom(region.latitudeDelta), {
        animate: true,
      });
    }
  }, [
    region?.latitude,
    region?.longitude,
    region?.latitudeDelta,
    map,
  ]);

  useEffect(() => {
    if (scrollEnabled === false) {
      map.dragging.disable();
      map.touchZoom.disable();
    } else {
      map.dragging.enable();
      map.touchZoom.enable();
    }
  }, [scrollEnabled, map]);

  useEffect(() => {
    if (zoomEnabled === false) {
      map.scrollWheelZoom.disable();
      map.doubleClickZoom.disable();
      map.boxZoom.disable();
    } else {
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
      map.boxZoom.enable();
    }
  }, [zoomEnabled, map]);

  return null;
}

// ── Expose map ref for imperative methods ──

function RefBridge({
  onMap,
}: {
  onMap: (map: L.Map) => void;
}) {
  const map = useMap();
  useEffect(() => {
    onMap(map);
  }, [map, onMap]);
  return null;
}

// ── MapView ──

const MapView = forwardRef<any, MapViewProps>(
  (
    {
      style,
      initialRegion,
      region,
      scrollEnabled,
      zoomEnabled,
      children,
    },
    ref
  ) => {
    const leafletMapRef = useRef<L.Map | null>(null);

    useImperativeHandle(ref, () => ({
      animateCamera: (camera: Camera, opts?: { duration?: number }) => {
        const map = leafletMapRef.current;
        if (!map) return;
        if (camera.center) {
          const zoom = camera.zoom ?? map.getZoom();
          map.flyTo(toLatLng(camera.center), zoom, {
            duration: ((opts?.duration ?? 300) / 1000),
          });
        }
      },
      fitToCoordinates: (
        coords: LatLng[],
        options?: { edgePadding?: EdgePadding; animated?: boolean }
      ) => {
        const map = leafletMapRef.current;
        if (!map || coords.length === 0) return;
        const bounds = L.latLngBounds(coords.map(toLatLng));
        const pad = options?.edgePadding;
        map.flyToBounds(bounds, {
          padding: [
            Math.max(pad?.top ?? 40, pad?.bottom ?? 40),
            Math.max(pad?.left ?? 40, pad?.right ?? 40),
          ],
          duration: options?.animated === false ? 0 : 0.3,
        });
      },
    }));

    const center = initialRegion
      ? toLatLng(initialRegion)
      : ([37.782, -122.413] as [number, number]);
    const zoom = initialRegion
      ? regionToZoom(initialRegion.latitudeDelta)
      : 14;

    return (
      <View style={[{ flex: 1 }, style]}>
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ width: "100%", height: "100%" }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <RegionController
            region={region}
            scrollEnabled={scrollEnabled}
            zoomEnabled={zoomEnabled}
          />
          <RefBridge onMap={(map) => { leafletMapRef.current = map; }} />
          {children}
        </MapContainer>
      </View>
    );
  }
);
MapView.displayName = "MapView";

// ── Marker ──

function Marker({ coordinate, title, pinColor, children }: MarkerProps) {
  const icon = pinColor ? makeColoredIcon(pinColor) : undefined;

  return (
    <LeafletMarker
      position={toLatLng(coordinate)}
      icon={icon}
      title={title}
    />
  );
}

// ── Polyline ──

function Polyline({ coordinates, strokeColor, strokeWidth }: PolylineProps) {
  return (
    <LeafletPolyline
      positions={coordinates.map(toLatLng)}
      pathOptions={{
        color: strokeColor ?? "#2563eb",
        weight: strokeWidth ?? 3,
      }}
    />
  );
}

export default MapView;
export { Marker, Polyline };
