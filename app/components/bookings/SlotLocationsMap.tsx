"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Button, buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/app/components/ui/cn";
import { DEFAULT_MAP_CENTER } from "@/lib/constants";
import { buildGoogleMapsUrl } from "@/lib/location";

type SlotLocationOffer = {
  key: string;
  pitchName: string;
  addressLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  productTypeLabel: string;
  priceLabel: string;
  helperLabel: string;
};

type SlotLocationsMapProps = {
  offers: SlotLocationOffer[];
  selectedOfferKey?: string | null;
  onSelectOffer?: (offerKey: string) => void;
};

const DEFAULT_CENTER: [number, number] = [DEFAULT_MAP_CENTER.lng, DEFAULT_MAP_CENTER.lat];

function buildPopupContent(offer: SlotLocationOffer) {
  const container = document.createElement("div");
  container.style.fontFamily = "Inter, system-ui, sans-serif";
  container.style.minWidth = "220px";
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
  title.textContent = offer.pitchName;

  const priceBadge = document.createElement("span");
  priceBadge.style.background = "#e8f6ff";
  priceBadge.style.color = "#0a6fcb";
  priceBadge.style.borderRadius = "999px";
  priceBadge.style.padding = "3px 8px";
  priceBadge.style.fontSize = "10px";
  priceBadge.style.fontWeight = "700";
  priceBadge.textContent = offer.priceLabel;

  header.append(title, priceBadge);

  const body = document.createElement("div");
  body.style.padding = "8px 12px";
  body.style.display = "grid";
  body.style.gap = "4px";
  body.style.fontSize = "11px";
  body.style.lineHeight = "1.35";
  body.style.color = "#2f3e52";

  const typeRow = document.createElement("div");
  typeRow.innerHTML = `<strong style="color:#0a6fcb;">Booking:</strong> ${offer.productTypeLabel}`;
  body.append(typeRow);

  const helperRow = document.createElement("div");
  helperRow.textContent = offer.helperLabel;
  body.append(helperRow);

  if (offer.addressLabel) {
    const addressRow = document.createElement("div");
    addressRow.innerHTML = `<strong style="color:#0a6fcb;">Where:</strong> ${offer.addressLabel}`;
    body.append(addressRow);
  }

  const mapUrl = buildGoogleMapsUrl(offer);
  if (mapUrl) {
    const link = document.createElement("a");
    link.href = mapUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Open in Google Maps";
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

  container.append(header, body);
  return container;
}

export default function SlotLocationsMap({
  offers,
  selectedOfferKey,
  onSelectOffer,
}: SlotLocationsMapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [geoDenied, setGeoDenied] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  const offersWithCoords = useMemo(
    () =>
      offers.filter(
        (offer) =>
          typeof offer.latitude === "number" &&
          Number.isFinite(offer.latitude) &&
          typeof offer.longitude === "number" &&
          Number.isFinite(offer.longitude),
      ),
    [offers],
  );

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!mapContainer.current || !token) return;
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: DEFAULT_CENTER,
      zoom: 11,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl());

    map.on("load", () => map.resize());

    return () => {
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    const markers: mapboxgl.Marker[] = [];
    for (const offer of offersWithCoords) {
      const isSelected = offer.key === selectedOfferKey;
      const marker = new mapboxgl.Marker({ color: isSelected ? "#00E5FF" : "#22FF88" })
        .setLngLat([offer.longitude!, offer.latitude!])
        .setPopup(
          new mapboxgl.Popup({ offset: 10, closeButton: true }).setDOMContent(
            buildPopupContent(offer),
          ),
        )
        .addTo(mapRef.current);

      marker.getElement().addEventListener("click", () => {
        onSelectOffer?.(offer.key);
        mapRef.current?.flyTo({
          center: [offer.longitude!, offer.latitude!],
          zoom: Math.max(mapRef.current?.getZoom() ?? 11, 13),
          speed: 1.2,
          curve: 1.4,
        });
      });
      markers.push(marker);
    }

    if (offersWithCoords.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      for (const offer of offersWithCoords) {
        bounds.extend([offer.longitude!, offer.latitude!]);
      }
      mapRef.current.fitBounds(bounds, { padding: 40, maxZoom: 13 });
    }

    return () => {
      for (const marker of markers) marker.remove();
    };
  }, [offersWithCoords, onSelectOffer, selectedOfferKey]);

  useEffect(() => {
    if (!mapRef.current || !selectedOfferKey) return;
    const offer = offersWithCoords.find((entry) => entry.key === selectedOfferKey);
    if (!offer) return;
    mapRef.current.flyTo({
      center: [offer.longitude!, offer.latitude!],
      zoom: Math.max(mapRef.current.getZoom(), 13),
      speed: 1.1,
    });
  }, [offersWithCoords, selectedOfferKey]);

  useEffect(() => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        if (!userMarkerRef.current && mapRef.current) {
          userMarkerRef.current = new mapboxgl.Marker({ color: "#0f172a" })
            .setLngLat([coords.lng, coords.lat])
            .setPopup(new mapboxgl.Popup({ offset: 10 }).setText("You are here"))
            .addTo(mapRef.current);
        } else {
          userMarkerRef.current?.setLngLat([coords.lng, coords.lat]);
        }
      },
      () => setGeoDenied(true),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  if (!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
    return (
      <div className="space-y-4">
        <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          Add <code>NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> to see the live map. You can still open
          each place in Google Maps below.
        </p>
        <div className="grid gap-3">
          {offers.map((offer) => {
            const mapUrl = buildGoogleMapsUrl(offer);
            return (
              <div
                key={offer.key}
                className={cn(
                  "rounded-[var(--radius-md)] border p-4",
                  offer.key === selectedOfferKey
                    ? "border-[rgba(125,211,252,0.38)] bg-[var(--color-accent-soft)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)]",
                )}
              >
                <p className="font-semibold text-[var(--color-text-primary)]">{offer.pitchName}</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{offer.helperLabel}</p>
                {offer.addressLabel ? (
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">{offer.addressLabel}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => onSelectOffer?.(offer.key)}>
                    Choose this place
                  </Button>
                  {mapUrl ? (
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants("secondary", "sm")}
                    >
                      Open map
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--color-text-secondary)]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex h-3 w-3 rounded-full bg-[#0f172a]" />
            You
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex h-3 w-3 rounded-full bg-[#22FF88]" />
            Places
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex h-3 w-3 rounded-full bg-[#00E5FF]" />
            Selected
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              if (!mapRef.current || offersWithCoords.length === 0) return;
              const bounds = new mapboxgl.LngLatBounds();
              for (const offer of offersWithCoords) {
                bounds.extend([offer.longitude!, offer.latitude!]);
              }
              mapRef.current.fitBounds(bounds, { padding: 40, maxZoom: 13 });
            }}
          >
            Show all places
          </Button>
          {typeof navigator !== "undefined" && navigator.geolocation ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={geoLoading}
              onClick={() => {
                if (!navigator.geolocation || !mapRef.current) return;
                setGeoLoading(true);
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    const coords = {
                      lat: position.coords.latitude,
                      lng: position.coords.longitude,
                    };
                    mapRef.current?.flyTo({
                      center: [coords.lng, coords.lat],
                      zoom: 12,
                      speed: 1.2,
                    });
                    if (!userMarkerRef.current && mapRef.current) {
                      userMarkerRef.current = new mapboxgl.Marker({ color: "#0f172a" })
                        .setLngLat([coords.lng, coords.lat])
                        .setPopup(new mapboxgl.Popup({ offset: 10 }).setText("You are here"))
                        .addTo(mapRef.current);
                    } else {
                      userMarkerRef.current?.setLngLat([coords.lng, coords.lat]);
                    }
                    setGeoLoading(false);
                  },
                  () => {
                    setGeoDenied(true);
                    setGeoLoading(false);
                  },
                  { enableHighAccuracy: true, timeout: 8000 },
                );
              }}
            >
              {geoLoading ? "Finding you..." : "Use my location"}
            </Button>
          ) : null}
        </div>
      </div>

      <div
        ref={mapContainer}
        className="h-[320px] w-full overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[#0b1624]"
      />

      {geoDenied ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          Location permission was denied. You can still compare places on the map.
        </p>
      ) : null}
    </div>
  );
}
