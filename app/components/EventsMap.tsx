"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { EventResponse } from "../types/eventTypes";

type Props = {
  events: EventResponse[];
  radiusKm: number;
  onRadiusChange: (radius: number) => void;
  onSearchHere: (center: { lat: number; lng: number }) => void;
};

const DEFAULT_CENTER: [number, number] = [38.7578, 9.0301]; // Addis Ababa-ish

export default function EventsMap({ events, radiusKm, onRadiusChange, onSearchHere }: Props) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoDenied, setGeoDenied] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: DEFAULT_CENTER[1], lng: DEFAULT_CENTER[0] });

  const eventsWithCoords = useMemo(
    () => events.filter((e) => e.latitude != null && e.longitude != null),
    [events]
  );

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!mapContainer.current || !token) return;
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: DEFAULT_CENTER,
      zoom: 12,
    });
    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl());

    map.on("load", () => map.resize());

    map.on("moveend", () => {
      const center = map.getCenter();
      setMapCenter({ lat: center.lat, lng: center.lng });
    });

    return () => {
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    // clear old markers (simple approach: remove and re-add)
    const markers: mapboxgl.Marker[] = [];
    eventsWithCoords.forEach((e) => {
      const dateLabel = new Date(e.eventDatetime).toLocaleString();
      const priceLabel = e.priceField == null || e.priceField === 0 ? "Free" : `ETB ${e.priceField}`;

      const marker = new mapboxgl.Marker({ color: "#22FF88" })
        .setLngLat([e.longitude!, e.latitude!])
        .setPopup(
          new mapboxgl.Popup({ offset: 10, closeButton: true }).setHTML(
            `<div style="font-family:Inter, system-ui, sans-serif; min-width:200px; color:#e8f4ff; background:#0d1c2c; border:1px solid #1f3850; border-radius:10px; box-shadow:0 8px 22px rgba(0,229,255,0.16); overflow:hidden">
              <div style="padding:10px 12px 6px; border-bottom:1px solid #1f3850; display:flex; justify-content:space-between; align-items:center; gap:8px">
                <div style="font-weight:700; font-size:13px; line-height:1.3; color:#22FF88;">${e.eventName}</div>
                <span style="background:#12313f; color:#00E5FF; border-radius:999px; padding:3px 8px; font-size:10px; font-weight:700;">${priceLabel}</span>
              </div>
              <div style="padding:8px 12px; display:grid; gap:4px; font-size:11px; line-height:1.35; color:#c0d5ec;">
                <div style="display:flex; gap:6px; align-items:flex-start;">
                  <span style="color:#00E5FF; font-weight:600;">Date:</span>
                  <span>${dateLabel}</span>
                </div>
                ${e.addressLabel ? `<div style="display:flex; gap:6px; align-items:flex-start;"><span style="color:#00E5FF; font-weight:600;">Where:</span><span>${e.addressLabel}</span></div>` : ""}
              </div>
              <a href="/events/${e.eventId}" style="display:block; text-align:center; margin:0 10px 10px; padding:8px 10px; background:linear-gradient(90deg,#00E5FF,#22FF88); color:#001021; font-weight:800; font-size:11px; border-radius:9px; text-decoration:none;">
                View details
              </a>
            </div>`
          )
        )
        .addTo(mapRef.current!);
      marker.getElement().addEventListener("click", () => {
        mapRef.current?.flyTo({
          center: [e.longitude!, e.latitude!],
          zoom: Math.max(mapRef.current?.getZoom() ?? 12, 13),
          speed: 1.2,
          curve: 1.4,
        });
      });
      markers.push(marker);
    });

    if (eventsWithCoords.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      eventsWithCoords.forEach((e) => bounds.extend([e.longitude!, e.latitude!]));
      if (userCoords) bounds.extend([userCoords.lng, userCoords.lat]);
      mapRef.current.fitBounds(bounds, { padding: 40, maxZoom: 14 });
    }

    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [eventsWithCoords, userCoords]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
        if (!mapRef.current) return;
        if (!userMarkerRef.current) {
          userMarkerRef.current = new mapboxgl.Marker({ color: "#00E5FF" })
            .setLngLat([coords.lng, coords.lat])
            .setPopup(new mapboxgl.Popup({ offset: 10 }).setText("You are here"))
            .addTo(mapRef.current);
        } else {
          userMarkerRef.current.setLngLat([coords.lng, coords.lat]);
        }
      },
      () => setGeoDenied(true),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

 

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#c0d5ec]">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-3 w-3 rounded-full bg-[#00E5FF]" /> You
          <span className="inline-flex h-3 w-3 rounded-full bg-[#22FF88]" /> Events
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="radius" className="text-xs text-[#9fb6ce]">Radius (km)</label>
          <select
            id="radius"
            value={radiusKm}
            onChange={(e) => onRadiusChange(Number(e.target.value))}
            className="rounded-md border border-[#1f3850] bg-[#0f1f2d] px-2 py-1 text-xs text-white"
          >
            {[10, 25, 50, 100].map((r) => (
              <option key={r} value={r}>{r} km</option>
            ))}
          </select>
        </div>
      </div>

      <div
        ref={mapContainer}
        className="h-80 w-full overflow-hidden rounded-xl border border-[#1f3850] bg-[#0b1624]"
      />
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => onSearchHere(mapCenter)}
          className="rounded-full bg-[#00E5FF] px-4 py-2 text-sm font-semibold text-[#001021] shadow-lg shadow-[#00e5ff44] transition hover:bg-[#22FF88]"
        >
          Search this area
        </button>
      </div>
      {geoDenied ? (
        <p className="text-xs text-[#ffb4b4]">Location permission denied. Showing all events.</p>
      ) : null}
      {!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ? (
        <p className="text-xs text-[#ffb4b4]">Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to enable the map.</p>
      ) : null}
    </div>
  );
}
