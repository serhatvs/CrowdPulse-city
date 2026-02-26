import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { HeatmapLayer } from "react-leaflet-heatmap-layer-v3";


// API'den heatmap verisi çekmek için endpoint (hata yönetimi ve abort destekli)
async function fetchHeatmap(bbox, signal) {
  const res = await fetch(`/api/heatmap?bbox=${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}`, { signal });
  if (!res.ok) throw new Error(res.statusText);
  return await res.json();
}

  const [heatmapData, setHeatmapData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchHeatmap(bbox, controller.signal);
        setHeatmapData(data);
      } catch (e) {
        if (e.name !== 'AbortError') {
          setError(e.message || 'Heatmap fetch hatası');
        }
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [bbox]);

  // HeatmapLayer expects: [{lat, lng, intensity}]
  const points = heatmapData.map(cell => ({
    lat: cell.lat,
    lng: cell.lon,
    intensity: cell.risk // 0-100
  }));

  if (loading) return <div>Harita yükleniyor...</div>;
  if (error) return <div style={{ color: 'red' }}>Harita yüklenemedi: {error}</div>;

  return (
    <MapContainer center={[bbox.minLat, bbox.minLon]} zoom={14} style={{ height: "100vh", width: "100%" }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <HeatmapLayer
        points={points}
        longitudeExtractor={p => p.lng}
        latitudeExtractor={p => p.lat}
        intensityExtractor={p => p.intensity}
        max={100}
        radius={20}
        blur={15}
        gradient={{ 0.2: "green", 0.5: "yellow", 0.8: "red" }}
      />
    </MapContainer>
  );
}
