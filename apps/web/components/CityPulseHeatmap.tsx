import React, { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type BBox = {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
};

type HeatCell = {
  lat: number;
  lon: number;
  risk: number;
  count: number;
};

type Point = {
  lat: number;
  lon: number;
};

type Props = {
  bbox: BBox;
  refreshKey?: number;
  minRisk?: number;
  maxRisk?: number;
  category?: number;
  timeWindow?: number;
  includeClosed?: boolean;
  selectedPoint?: Point | null;
  reportedPoint?: Point | null;
  focusPoint?: Point | null;
  focusToken?: number;
  resetViewToken?: number;
  onMapClick?: (lat: number, lon: number) => void;
};

function riskToColor(risk: number): string {
  if (risk >= 70) {
    return "#d73027";
  }
  if (risk >= 40) {
    return "#fc8d59";
  }
  if (risk >= 20) {
    return "#fee08b";
  }
  return "#91cf60";
}

function MapClickCapture({ onMapClick }: { onMapClick?: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(event) {
      if (onMapClick) {
        onMapClick(event.latlng.lat, event.latlng.lng);
      }
    },
  });
  return null;
}

function MapViewportControl({
  bbox,
  focusPoint,
  focusToken = 0,
  resetViewToken = 0,
}: {
  bbox: BBox;
  focusPoint?: Point | null;
  focusToken?: number;
  resetViewToken?: number;
}) {
  const map = useMap();
  const defaultCenterLat = (bbox.minLat + bbox.maxLat) / 2;
  const defaultCenterLon = (bbox.minLon + bbox.maxLon) / 2;

  useEffect(() => {
    if (resetViewToken <= 0) {
      return;
    }
    map.flyTo([defaultCenterLat, defaultCenterLon], 14, { duration: 0.45 });
  }, [map, defaultCenterLat, defaultCenterLon, resetViewToken]);

  useEffect(() => {
    if (!focusPoint || focusToken <= 0) {
      return;
    }
    map.flyTo([focusPoint.lat, focusPoint.lon], Math.max(16, map.getZoom()), { duration: 0.45 });
  }, [map, focusPoint, focusToken]);

  return null;
}

async function fetchHeatmap(
  bbox: BBox,
  signal: AbortSignal,
  params: { minRisk: number; maxRisk: number; category?: number; timeWindow?: number; includeClosed?: boolean },
): Promise<HeatCell[]> {
  const query = new URLSearchParams({
    bbox: `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}`,
    minRisk: String(params.minRisk),
    maxRisk: String(params.maxRisk),
  });
  if (params.category && params.category > 0) {
    query.set("category", String(params.category));
  }
  if (params.timeWindow && params.timeWindow > 0) {
    query.set("timeWindow", String(params.timeWindow));
  }
  if (typeof params.includeClosed === "boolean") {
    query.set("includeClosed", String(params.includeClosed));
  }

  const res = await fetch(`/api/heatmap?${query.toString()}`, { signal });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Heatmap fetch failed (${res.status}): ${text}`);
  }
  return (await res.json()) as HeatCell[];
}

export default function CityPulseHeatmap({
  bbox,
  refreshKey = 0,
  minRisk = 0,
  maxRisk = 100,
  category = 0,
  timeWindow = 24,
  includeClosed = true,
  selectedPoint = null,
  reportedPoint = null,
  focusPoint = null,
  focusToken = 0,
  resetViewToken = 0,
  onMapClick,
}: Props) {
  const [heatmapData, setHeatmapData] = useState<HeatCell[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchHeatmap(bbox, controller.signal, { minRisk, maxRisk, category, timeWindow, includeClosed });
        setHeatmapData(data);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setError(err instanceof Error ? err.message : "Heatmap fetch failed");
        }
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [bbox, refreshKey, minRisk, maxRisk, category, timeWindow, includeClosed]);

  const center = useMemo<[number, number]>(
    () => [(bbox.minLat + bbox.maxLat) / 2, (bbox.minLon + bbox.maxLon) / 2],
    [bbox],
  );

  if (loading) {
    return <div>Harita yukleniyor...</div>;
  }
  if (error) {
    return <div style={{ color: "red", padding: 8 }}>Harita yuklenemedi: {error}</div>;
  }

  return (
    <MapContainer center={center} zoom={14} style={{ height: "100%", minHeight: 520, width: "100%" }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapViewportControl
        bbox={bbox}
        focusPoint={focusPoint}
        focusToken={focusToken}
        resetViewToken={resetViewToken}
      />
      <MapClickCapture onMapClick={onMapClick} />
      {selectedPoint ? (
        <CircleMarker
          center={[selectedPoint.lat, selectedPoint.lon]}
          radius={10}
          pathOptions={{ color: "#1664c0", fillColor: "#5ca3ff", fillOpacity: 0.75, weight: 2 }}
        >
          <Tooltip permanent direction="top" offset={[0, -8]}>
            Selected report point
          </Tooltip>
        </CircleMarker>
      ) : null}
      {reportedPoint ? (
        <CircleMarker
          center={[reportedPoint.lat, reportedPoint.lon]}
          radius={8}
          pathOptions={{ color: "#0f7f73", fillColor: "#2eb89d", fillOpacity: 0.85, weight: 2 }}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            Last reported hazard
          </Tooltip>
        </CircleMarker>
      ) : null}
      {heatmapData.map((cell) => (
        <CircleMarker
          key={`${cell.lat}-${cell.lon}`}
          center={[cell.lat, cell.lon]}
          radius={Math.max(4, Math.min(20, Math.round(cell.risk / 6) + 2))}
          pathOptions={{ color: riskToColor(cell.risk), fillOpacity: 0.65 }}
        >
          <Tooltip>
            Risk: {cell.risk} / 100
            <br />
            Kayit: {cell.count}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
