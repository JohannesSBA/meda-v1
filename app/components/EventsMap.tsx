/**
 * EventsMap -- interactive Mapbox map showing multiple event markers with clustering.
 *
 * Supports date/category filters and marker selection.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { EventResponse } from "../types/eventTypes";
import { Select } from "./ui/select";
import { Button } from "./ui/button";
import { DEFAULT_MAP_CENTER } from "@/lib/constants";

type Props = {
  events: EventResponse[];
  radiusKm: number;
  onRadiusChange: (radius: number) => void;
  onSearchHere: (center: { lat: number; lng: number }) => void;
};

const DEFAULT_CENTER: [number, number] = [DEFAULT_MAP_CENTER.lng, DEFAULT_MAP_CENTER.lat];

function buildPopupContent(
  event: EventResponse,
  dateLabel: string,
  priceLabel: string,
) {
  const container = document.createElement("div");
  container.style.fontFamily = "Inter, system-ui, sans-serif";
  container.style.minWidth = "200px";
  container.style.background = "#ffffff";
  container.style.border = "1px solid #e3ebf5";
  container.style.borderRadius = "10px";
  container.style.boxShadow = "0 10px 26px rgba(0,0,0,0.14)";
  container.style.overflow = "hidden";

  const header = document.createElement("div");
  header.style.padding = "10px 12px 6px";
  header.style.borderBottom = "1px solid #e9f1fb";
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.style.gap = "8px";

  const title = document.createElement("div");
  title.style.fontWeight = "700";
  title.style.fontSize = "13px";
  title.style.lineHeight = "1.3";
  title.style.color = "#0f2235";
  title.textContent = event.eventName;

  const priceBadge = document.createElement("span");
  priceBadge.style.background = "#e8f6ff";
  priceBadge.style.color = "#0a6fcb";
  priceBadge.style.borderRadius = "999px";
  priceBadge.style.padding = "3px 8px";
  priceBadge.style.fontSize = "10px";
  priceBadge.style.fontWeight = "700";
  priceBadge.textContent = priceLabel;

  header.append(title, priceBadge);

  const body = document.createElement("div");
  body.style.padding = "8px 12px";
  body.style.display = "grid";
  body.style.gap = "4px";
  body.style.fontSize = "11px";
  body.style.lineHeight = "1.35";
  body.style.color = "#2f3e52";

  const dateRow = document.createElement("div");
  dateRow.style.display = "flex";
  dateRow.style.gap = "6px";
  dateRow.style.alignItems = "flex-start";
  const dateLabelNode = document.createElement("span");
  dateLabelNode.style.color = "#0a6fcb";
  dateLabelNode.style.fontWeight = "600";
  dateLabelNode.textContent = "Date:";
  const dateValue = document.createElement("span");
  dateValue.textContent = dateLabel;
  dateRow.append(dateLabelNode, dateValue);
  body.append(dateRow);

  if (event.addressLabel) {
    const locationRow = document.createElement("div");
    locationRow.style.display = "flex";
    locationRow.style.gap = "6px";
    locationRow.style.alignItems = "flex-start";
    const locationLabelNode = document.createElement("span");
    locationLabelNode.style.color = "#0a6fcb";
    locationLabelNode.style.fontWeight = "600";
    locationLabelNode.textContent = "Where:";
    const locationValue = document.createElement("span");
    locationValue.textContent = event.addressLabel;
    locationRow.append(locationLabelNode, locationValue);
    body.append(locationRow);
  }

  const link = document.createElement("a");
  link.href = `/events/${event.eventId}`;
  link.textContent = "View details";
  link.style.display = "block";
  link.style.textAlign = "center";
  link.style.margin = "0 10px 10px";
  link.style.padding = "8px 10px";
  link.style.background = "linear-gradient(90deg,#00E5FF,#22FF88)";
  link.style.color = "#001021";
  link.style.fontWeight = "800";
  link.style.fontSize = "11px";
  link.style.borderRadius = "9px";
  link.style.textDecoration = "none";

  container.append(header, body, link);
  return container;
}

export default function EventsMap({ events, radiusKm, onRadiusChange, onSearchHere }: Props) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const hasInitialFitRef = useRef(false);
  const [geoDenied, setGeoDenied] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
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
          new mapboxgl.Popup({ offset: 10, closeButton: true }).setDOMContent(
            buildPopupContent(e, dateLabel, priceLabel),
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

    if (eventsWithCoords.length > 0 && !hasInitialFitRef.current) {
      const bounds = new mapboxgl.LngLatBounds();
      eventsWithCoords.forEach((e) => bounds.extend([e.longitude!, e.latitude!]));
      mapRef.current.fitBounds(bounds, { padding: 40, maxZoom: 14 });
      hasInitialFitRef.current = true;
    }

    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [eventsWithCoords]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
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
          <Select
            id="radius"
            value={radiusKm}
            onChange={(e) => onRadiusChange(Number(e.target.value))}
            className="h-8 rounded-md border-[#1f3850] bg-[#0f1f2d] px-2 text-xs text-white"
          >
            {[10, 25, 50, 100].map((r) => (
              <option key={r} value={r}>{r} km</option>
            ))}
          </Select>
        </div>
      </div>

      <div
        ref={mapContainer}
        className="h-80 w-full overflow-hidden rounded-xl border border-[#1f3850] bg-[#0b1624]"
      />
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          onClick={() => onSearchHere(mapCenter)}
          variant="primary"
          size="sm"
          className="rounded-full"
        >
          Search this area
        </Button>
        {typeof navigator !== "undefined" && navigator.geolocation && !geoDenied ? (
          <Button
            type="button"
            onClick={() => {
              setGeoLoading(true);
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                  onSearchHere(coords);
                  if (mapRef.current) {
                    mapRef.current.flyTo({
                      center: [coords.lng, coords.lat],
                      zoom: 12,
                      speed: 1.2,
                    });
                  }
                  setGeoLoading(false);
                },
                () => {
                  setGeoDenied(true);
                  setGeoLoading(false);
                },
                { enableHighAccuracy: true, timeout: 8000 }
              );
            }}
            variant="secondary"
            size="sm"
            className="rounded-full"
            disabled={geoLoading}
          >
            {geoLoading ? "Getting location…" : "Use my location"}
          </Button>
        ) : null}
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
