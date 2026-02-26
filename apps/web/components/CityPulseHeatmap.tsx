import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { HeatmapLayer } from "react-leaflet-heatmap-layer-v3";

// API'den heatmap verisi çekmek için örnek endpoint
async function fetchHeatmap(bbox) {
  // bbox: { minLat, minLon, maxLat, maxLon }
  const res = await fetch(`/api/heatmap?bbox=${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}`);
  return await res.json(); // [{ lat, lon, risk }]
}

export default function CityPulseHeatmap({ bbox }) {
  const [heatmapData, setHeatmapData] = useState([]);

  useEffect(() => {
    fetchHeatmap(bbox).then(setHeatmapData);
  }, [bbox]);

  // HeatmapLayer expects: [{lat, lng, intensity}]
  const points = heatmapData.map(cell => ({
    lat: cell.lat,
    lng: cell.lon,
    intensity: cell.risk // 0-100
  }));

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
