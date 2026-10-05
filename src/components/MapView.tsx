"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { STATUS_META } from "@/lib/leads";
import type { GeoPoint, Lead, WebsiteStatus } from "@/lib/types";

export interface MapLead {
  lead: Lead;
  status: WebsiteStatus;
}

interface Props {
  center: GeoPoint | null;
  radius: number;
  items: MapLead[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPickCenter: (p: GeoPoint) => void;
}

const PORTUGAL: [number, number] = [39.6, -8.0];

function FitToCircle({ center, radius }: { center: GeoPoint | null; radius: number }) {
  const map = useMap();
  useEffect(() => {
    if (!center) return;
    map.fitBounds(L.latLng(center.lat, center.lon).toBounds(radius * 2.2), { animate: true });
  }, [map, center, radius]);
  return null;
}

function FocusSelected({ items, selectedId }: { items: MapLead[]; selectedId: string | null }) {
  const map = useMap();
  useEffect(() => {
    const item = items.find((i) => i.lead.id === selectedId);
    if (item && !map.getBounds().contains([item.lead.lat, item.lead.lon])) {
      map.panTo([item.lead.lat, item.lead.lon]);
    }
    // Only react to selection changes, not to every audit update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedId]);
  return null;
}

function ClickToPick({ onPick }: { onPick: (p: GeoPoint) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lon: e.latlng.lng }) });
  return null;
}

export default function MapView({ center, radius, items, selectedId, onSelect, onPickCenter }: Props) {
  return (
    <MapContainer center={PORTUGAL} zoom={7} preferCanvas className="h-full w-full" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToCircle center={center} radius={radius} />
      <FocusSelected items={items} selectedId={selectedId} />
      <ClickToPick onPick={onPickCenter} />
      {center && (
        <>
          <Circle
            center={[center.lat, center.lon]}
            radius={radius}
            pathOptions={{ color: "#4f46e5", weight: 2, fillOpacity: 0.04, dashArray: "6 6" }}
            interactive={false}
          />
          <CircleMarker
            center={[center.lat, center.lon]}
            radius={5}
            pathOptions={{ color: "#fff", weight: 2, fillColor: "#4f46e5", fillOpacity: 1 }}
            interactive={false}
          />
        </>
      )}
      {items.map(({ lead, status }) => {
        const selected = lead.id === selectedId;
        return (
          <CircleMarker
            key={lead.id}
            center={[lead.lat, lead.lon]}
            radius={selected ? 10 : 6.5}
            pathOptions={{
              color: selected ? "#111827" : "#ffffff",
              weight: selected ? 3 : 1.5,
              fillColor: STATUS_META[status].color,
              fillOpacity: 0.95,
            }}
            eventHandlers={{ click: () => onSelect(lead.id) }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <strong>{lead.name}</strong>
              <br />
              {lead.category} · {STATUS_META[status].short}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
