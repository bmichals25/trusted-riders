import { useEffect, useRef, useState } from "react";
import {
  getDirections,
  distanceBetween,
  type DirectionsResult,
} from "./directions-service";

type LatLng = { latitude: number; longitude: number };

const REFETCH_DISTANCE = 200; // meters
const MIN_REFETCH_INTERVAL = 30_000; // ms

export function useDirections(
  origin: LatLng | null,
  destination: LatLng | null,
) {
  const [result, setResult] = useState<DirectionsResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const lastFetchOrigin = useRef<LatLng | null>(null);
  const lastFetchTime = useRef(0);

  useEffect(() => {
    if (!origin || !destination) return;

    // Skip if origin hasn't moved enough or too soon since last fetch
    if (lastFetchOrigin.current) {
      const dist = distanceBetween(origin, lastFetchOrigin.current);
      const elapsed = Date.now() - lastFetchTime.current;
      if (dist < REFETCH_DISTANCE && elapsed < MIN_REFETCH_INTERVAL) return;
    }

    let cancelled = false;

    async function fetch() {
      setIsLoading(true);
      const data = await getDirections(origin!, destination!);
      if (!cancelled) {
        setResult(data);
        lastFetchOrigin.current = origin;
        lastFetchTime.current = Date.now();
        setIsLoading(false);
      }
    }

    fetch();

    return () => {
      cancelled = true;
    };
  }, [origin, destination]);

  return { ...result, isLoading };
}
