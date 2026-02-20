"use client";
import Image from "next/image";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Category } from "../types/catagory";
import axios from "axios";
import { authClient } from "@/lib/auth/client";
import { User } from "@neondatabase/auth/types";
import { toast } from "sonner";
import { useRouter } from "next/navigation";


export default function CreateEventForm({ categories }: { categories: Category[] }) {

   

  const [form, setForm] = useState({
    eventName: "",
    categoryId: categories[0]?.categoryId ?? "",
    description: "",
    image: null as File | null,
    imagePreview: "",
    startDate: "",
    endDate: "",
    location: "",
    latitude: "9.01524",
    longitude: "38.814349",
    capacity: "10",
    price: "0"
  });
  const [submitting, setSubmitting] = useState(false);
  const [timezone, setTimezone] = useState("");
  const [locStatus, setLocStatus] = useState<"idle" | "locating" | "error" | "done">("idle");
  const [user, setUser] = useState<User | null>(null);

  const router = useRouter();

   useEffect(() => {
    authClient.getSession().then((result) => {
      if (result.data?.user) {
        setUser(result.data.user);
      }
    });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && file.size > 6 * 1024 * 1024) {
      toast.error("Image too large (max 6MB)");
      return;
    }
    setForm(prev => ({ ...prev, image: file }));
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(prev => ({ ...prev, imagePreview: reader.result as string }));
      };
      reader.readAsDataURL(file);
    } else {
      setForm(prev => ({ ...prev, imagePreview: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.startDate && form.endDate && new Date(form.endDate) <= new Date(form.startDate)) {
      toast.error("End time must be after start time");
      return;
    }
    setSubmitting(true);
    const fd = new FormData();
    fd.append("eventName", form.eventName);
    fd.append("categoryId", form.categoryId);
    if (form.description) fd.append("description", form.description);
    fd.append("startDate", form.startDate);
    fd.append("endDate", form.endDate);
    fd.append("location", form.location);
    fd.append("latitude", form.latitude);
    fd.append("longitude", form.longitude);
    if (form.capacity) fd.append("capacity", form.capacity);
    if (form.price) fd.append("price", form.price);
    if (user?.id) fd.append("userId", user.id);
    if (form.image) fd.append("image", form.image);

    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/events/create`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Event created successfully");
      router.push(`/events/${res.data.event.eventId}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create event");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }
    setLocStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setLocStatus("done");
      },
      () => {
        setLocStatus("error");
        toast.error("Could not fetch location");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const preview = useMemo(
    () => ({
      title: form.eventName || "Untitled event",
      date: form.startDate ? new Date(form.startDate).toLocaleString() : "Date TBD",
      location: form.location || "Location pending",
      price:
        form.price && Number(form.price) > 0
          ? `ETB ${Number(form.price).toFixed(0)}`
          : "Free",
      capacity: form.capacity || "—",
    }),
    [form.eventName, form.startDate, form.location, form.price, form.capacity]
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <form
        className="space-y-7 rounded-2xl border border-white/6 bg-[#0f1f2d]/80 px-6 py-8 shadow-xl shadow-black/30 backdrop-blur"
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-[#7ccfff]">Event basics</p>
            <h2 className="text-xl font-semibold text-white">Details</h2>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-[#b9cde4]">TZ: {timezone || "Auto"}</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="eventName" className="mb-1 block text-sm font-medium text-[#b9cde4]">
              Event name
            </label>
            <input
              type="text"
              id="eventName"
              name="eventName"
              required
              placeholder="e.g. Friday Night 5v5"
              className="w-full rounded-xl border border-white/10 bg-[#112030] px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
              value={form.eventName}
              onChange={handleChange}
            />
          </div>

          <div>
            <label htmlFor="category" className="mb-1 block text-sm font-medium text-[#b9cde4]">
              Category
            </label>
            <select
              id="category"
              name="categoryId"
              className="w-full rounded-xl border border-white/10 bg-[#112030] px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
              value={form.categoryId}
              onChange={handleChange}
            >
              {categories.map((category) => (
                <option value={category.categoryId} key={category.categoryId}>
                  {category.categoryName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="price" className="mb-1 block text-sm font-medium text-[#b9cde4]">
              Price (ETB)
            </label>
            <input
              type="number"
              id="price"
              name="price"
              min="0"
              step="1"
              placeholder="0 for free"
              className="w-full rounded-xl border border-white/10 bg-[#112030] px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#22FF88]"
              value={form.price}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="startDate" className="mb-1 block text-sm font-medium text-[#b9cde4]">
                Start
              </label>
              <span className="text-xs text-[#7aa8c6]">Local: {timezone || "device"}</span>
            </div>
            <input
              type="datetime-local"
              id="startDate"
              name="startDate"
              required
              className="w-full rounded-xl border border-white/10 bg-[#112030] px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
              value={form.startDate}
              onChange={handleChange}
            />
          </div>
          <div>
            <label htmlFor="endDate" className="mb-1 block text-sm font-medium text-[#b9cde4]">
              End
            </label>
            <input
              type="datetime-local"
              id="endDate"
              name="endDate"
              required
              className="w-full rounded-xl border border-white/10 bg-[#112030] px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
              value={form.endDate}
              onChange={handleChange}
            />
          </div>
        </div>

        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-[#b9cde4]">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            placeholder="Format, skill level, what to bring, etc."
            className="w-full rounded-xl border border-white/10 bg-[#112030] px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
            value={form.description}
            onChange={handleChange}
          />
          <div className="mt-1 text-xs text-[#7aa8c6]">Keep it crisp. Players decide fast.</div>
        </div>

        <div className="rounded-xl border border-white/8 bg-[#0f2336] p-4 shadow-inner shadow-black/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Location</p>
              <p className="text-xs text-[#7aa8c6]">Searchable label + precise pin</p>
            </div>
            <button
              type="button"
              onClick={handleUseMyLocation}
              className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:border-[#00E5FF]"
            >
              {locStatus === "locating" ? "Locating…" : "Use my location"}
            </button>
          </div>

          <div className="mt-3 space-y-3">
            <input
              type="text"
              id="location"
              name="location"
              placeholder="e.g. Gulele Stadium"
              required
              className="w-full rounded-xl border border-white/10 bg-[#112030] px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
              value={form.location}
              onChange={handleChange}
            />

            <MapPicker
              latitude={form.latitude}
              longitude={form.longitude}
              onChange={(lat, lng) =>
                setForm((prev) => ({
                  ...prev,
                  latitude: lat.toString(),
                  longitude: lng.toString(),
                }))
              }
            />

            <div className="grid gap-3 sm:grid-cols-2 text-xs text-[#9fc4e4]">
              <div className="rounded-lg border border-white/8 bg-[#0f1f2d] px-3 py-2">
                <span className="text-[#7ccfff]">Lat</span>: {form.latitude}
              </div>
              <div className="rounded-lg border border-white/8 bg-[#0f1f2d] px-3 py-2">
                <span className="text-[#7ccfff]">Lng</span>: {form.longitude}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="capacity" className="mb-1 block text-sm font-medium text-[#b9cde4]">
              Capacity
            </label>
            <input
              type="number"
              id="capacity"
              name="capacity"
              min="1"
              placeholder="eg. 10"
              className="w-full rounded-xl border border-white/10 bg-[#112030] px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#22FF88]"
              value={form.capacity}
              onChange={handleChange}
            />
          </div>
          <div>
            <label htmlFor="image" className="mb-1 block text-sm font-medium text-[#b9cde4]">
              Event image (≤6MB)
            </label>
            <input
              type="file"
              id="image"
              name="image"
              accept="image/*"
              className="block w-full text-[#b9cde4]"
              onChange={handleImageChange}
            />
            {form.imagePreview && (
              <div className="mt-2 overflow-hidden rounded-lg border border-white/8 bg-[#0f1f2a]">
                <Image
                  src={form.imagePreview}
                  alt="Event Preview"
                  width={640}
                  height={360}
                  className="h-auto w-full object-cover"
                />
              </div>
            )}
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-full bg-linear-to-r from-[#00E5FF] to-[#22FF88] px-6 py-3 text-base font-bold uppercase tracking-wider text-[#001021] transition duration-200 hover:from-[#22FF88] hover:to-[#00E5FF] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00E5FF]/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Create Event"}
          </button>
        </div>
      </form>

      <aside className="space-y-4 rounded-2xl border border-white/6 bg-[#0d1d2e]/70 p-6 shadow-xl shadow-black/30 backdrop-blur">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-[#7ccfff]">Live preview</p>
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0f2235] to-[#0b1624] p-5 shadow-lg shadow-black/30">
            <div className="flex items-center justify-between text-xs text-[#9fc4e4]">
              <span>{preview.date}</span>
              <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-[#22FF88]">{preview.price}</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold text-white">{preview.title}</h3>
            <p className="mt-1 text-sm text-[#9fc4e4]">{preview.location}</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-[#7aa8c6]">
              <span className="rounded-full bg-white/5 px-2 py-1">Capacity: {preview.capacity}</span>
              <span className="rounded-full bg-white/5 px-2 py-1">TZ: {timezone || "local"}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-[#0f2235] p-4 text-sm text-[#b9cde4] shadow-inner shadow-black/20">
          <p className="mb-2 text-xs uppercase tracking-[0.14em] text-[#7ccfff]">Tips</p>
          <ul className="space-y-2 list-disc pl-4">
            <li>Lead with format and level so players self-select.</li>
            <li>Add exact pin; we’ll surface it on the map for nearby players.</li>
            <li>Images load best at 1200x630, under 6MB.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

type MapPickerProps = {
  latitude: string;
  longitude: string;
  onChange: (lat: number, lng: number) => void;
};

const DEFAULT_CENTER: [number, number] = [38.7578, 9.0301]; // Addis Ababa-ish fallback

function MapPicker({ latitude, longitude, onChange }: MapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const onChangeRef = useRef(onChange);

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  const [initialCoords] = useState<[number, number]>(() =>
    Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
      ? [Number(longitude), Number(latitude)]
      : DEFAULT_CENTER
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

  // Keep marker in sync when user types coordinates manually.
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    const latNum = Number(latitude);
    const lngNum = Number(longitude);
    if (!map || !marker || !Number.isFinite(latNum) || !Number.isFinite(lngNum)) return;
    const nextCoords: [number, number] = [lngNum, latNum];
    marker.setLngLat(nextCoords);
    map.easeTo({ center: nextCoords, duration: 250 });
  }, [latitude, longitude]);

  if (!token) {
    return (
      <div className="rounded-lg border border-[#22344a] bg-[#0f1f2f] p-4 text-sm text-[#b9cde4]">
        Set <code className="text-[#89e7ff]">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> to enable the map picker.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#89e7ff]">Pin the pitch</h3>
        <p className="text-xs text-[#b9cde4]">
          Click the map or drag the pin to set coordinates.
        </p>
      </div>
      <div
        ref={mapContainerRef}
        className="h-72 w-full overflow-hidden rounded-lg border border-[#22344a] bg-[#0b1624]"
      />
      <div className="flex gap-3 text-xs text-[#d7e9ff]">
        <div className="rounded-md bg-[#102033] px-3 py-2">
          <span className="text-[#89e7ff]">Lat:</span>{" "}
          {(
            Number.isFinite(Number(latitude))
              ? Number(latitude)
              : initialCoords[1]
          ).toFixed(6)}
        </div>
        <div className="rounded-md bg-[#102033] px-3 py-2">
          <span className="text-[#89e7ff]">Lng:</span>{" "}
          {(
            Number.isFinite(Number(longitude))
              ? Number(longitude)
              : initialCoords[0]
          ).toFixed(6)}
        </div>
      </div>
    </div>
  );
}
