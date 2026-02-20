"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type Props = {
  latitude: number;
  longitude: number;
};

export default function StaticEventMap({ latitude, longitude }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!containerRef.current || !token) return;
    mapboxgl.accessToken = token;

    const center: [number, number] = [longitude, latitude];
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center,
      zoom: 13,
      interactive: false,
      pitchWithRotate: false,
      dragRotate: false,
    });
    mapRef.current = map;

    new mapboxgl.Marker({ color: "#22FF88" }).setLngLat(center).addTo(map);

    map.on("load", () => {
      map.resize();
      map.scrollZoom?.disable();
      map.boxZoom?.disable();
      map.dragPan?.disable();
      map.dragRotate?.disable();
      map.keyboard?.disable();
      map.doubleClickZoom?.disable();
      map.touchZoomRotate?.disable();
    });

    return () => map.remove();
  }, [latitude, longitude]);

  if (!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0b1624] p-4 text-sm text-[#b9cde4]">
        Set <code className="text-[#7ccfff]">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> to display the map.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-80 w-full overflow-hidden rounded-2xl border border-white/8 bg-[#0b1624] shadow-inner shadow-black/30"
    />
  );
}
