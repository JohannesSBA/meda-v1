/**
 * LocationSection -- Address input, "Use my location" button, and MapPicker.
 *
 * Renders the location card with address field, geolocation button, and coordinate display.
 */

"use client";

import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { MapPicker } from "./MapPicker";

type LocationSectionProps = {
  location: string;
  latitude: string;
  longitude: string;
  locStatus: "idle" | "locating" | "error" | "done";
  onLocationChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCoordsChange: (lat: number, lng: number) => void;
  onUseMyLocation: () => void;
};

export function LocationSection({
  location,
  latitude,
  longitude,
  locStatus,
  onLocationChange,
  onCoordsChange,
  onUseMyLocation,
}: LocationSectionProps) {
  return (
    <div className="rounded-xl border border-white/8 bg-[#0f2336] p-4 shadow-inner shadow-black/30">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Location</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            Searchable label + precise pin
          </p>
        </div>
        <Button
          type="button"
          onClick={onUseMyLocation}
          variant="secondary"
          size="sm"
          className="rounded-full px-3"
        >
          {locStatus === "locating" ? "Locating…" : "Use my location"}
        </Button>
      </div>

      <div className="mt-3 space-y-3">
        <Input
          type="text"
          id="location"
          name="location"
          placeholder="e.g. Gulele Stadium"
          required
          className="h-12 bg-[#112030] px-4"
          value={location}
          onChange={onLocationChange}
        />

        <MapPicker
          latitude={latitude}
          longitude={longitude}
          onChange={onCoordsChange}
        />

        <div className="grid gap-3 sm:grid-cols-2 text-sm text-[var(--color-text-secondary)]">
          <div className="rounded-lg border border-white/8 bg-[#0f1f2d] px-3 py-2">
            <span className="text-[#7ccfff]">Lat</span>: {latitude}
          </div>
          <div className="rounded-lg border border-white/8 bg-[#0f1f2d] px-3 py-2">
            <span className="text-[#7ccfff]">Lng</span>: {longitude}
          </div>
        </div>
      </div>
    </div>
  );
}
