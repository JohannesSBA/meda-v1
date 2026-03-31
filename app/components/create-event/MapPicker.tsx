/**
 * MapPicker -- Mapbox-based map component for selecting event location coordinates.
 *
 * Renders a draggable marker; users can click the map or drag the pin to set lat/lng.
 * Requires NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN. Syncs with parent when coordinates change.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type MapPickerProps = {
  latitude: string;
  longitude: string;
  onChange: (lat: number, lng: number) => void;
};

const DEFAULT_CENTER: [number, number] = [38.7578, 9.0301]; // Addis Ababa-ish fallback

export function MapPicker({ latitude, longitude, onChange }: MapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const onChangeRef = useRef(onChange);

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  const [initialCoords] = useState<[number, number]>(() =>
    Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
      ? [Number(longitude), Number(latitude)]
      : DEFAULT_CENTER,
  );

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const handleSelect = useCallback((lng: number, lat: number) => {
    const trimmedLng = Number(lng.toFixed(6));
    const trimmedLat = Number(lat.toFixed(6));
    onChangeRef.current(trimmedLat, trimmedLng);
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || !token) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: initialCoords,
      zoom: 12,
    });
    mapRef.current = map;

    const marker = new mapboxgl.Marker({ draggable: true })
      .setLngLat(initialCoords)
      .addTo(map);
    markerRef.current = marker;

    const updateFromMarker = () => {
      const lngLat = marker.getLngLat();
      handleSelect(lngLat.lng, lngLat.lat);
    };

    marker.on("dragend", updateFromMarker);

    map.on("click", (event) => {
      marker.setLngLat(event.lngLat);
      handleSelect(event.lngLat.lng, event.lngLat.lat);
    });

    map.on("load", () => map.resize());

    return () => {
      marker.remove();
      map.remove();
    };
  }, [handleSelect, initialCoords, token]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    const latNum = Number(latitude);
    const lngNum = Number(longitude);
    if (!map || !marker || !Number.isFinite(latNum) || !Number.isFinite(lngNum))
      return;
    const nextCoords: [number, number] = [lngNum, latNum];
    marker.setLngLat(nextCoords);
    map.easeTo({ center: nextCoords, duration: 250 });
  }, [latitude, longitude]);

  if (!token) {
    return (
      <div className="rounded-lg border border-[#22344a] bg-[#0f1f2f] p-4 text-sm text-[var(--color-text-secondary)]">
        Set{" "}
        <code className="text-[#89e7ff]">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code>{" "}
        to enable the map picker.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#89e7ff]">Pin the pitch</h3>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Click the map or drag the pin to set coordinates.
        </p>
      </div>
      <div
        ref={mapContainerRef}
        className="h-72 w-full overflow-hidden rounded-lg border border-[#22344a] bg-[#0b1624]"
      />
      <div className="flex gap-3 text-sm text-[var(--color-text-secondary)]">
        <div className="rounded-md bg-[#102033] px-3 py-2">
          <span className="text-[#89e7ff]">Lat:</span>{" "}
          {(Number.isFinite(Number(latitude))
            ? Number(latitude)
            : initialCoords[1]
          ).toFixed(6)}
        </div>
        <div className="rounded-md bg-[#102033] px-3 py-2">
          <span className="text-[#89e7ff]">Lng:</span>{" "}
          {(Number.isFinite(Number(longitude))
            ? Number(longitude)
            : initialCoords[0]
          ).toFixed(6)}
        </div>
      </div>
    </div>
  );
}
