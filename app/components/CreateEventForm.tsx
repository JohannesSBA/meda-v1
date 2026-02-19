"use client";
import Image from "next/image";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
    capacity: "",
    price: ""
  });
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
    }
  };

  return (
    <form
      className=" w-full space-y-7 rounded-xl bg-[#18243b] px-6 py-8 shadow-lg"
      onSubmit={handleSubmit}
    >
      <div>
        <label htmlFor="eventName" className="block text-sm font-medium text-[#89e7ff] mb-1">
          Event Name
        </label>
        <input
          type="text"
          id="eventName"
          name="eventName"
          required
          className="w-full rounded-lg border-none bg-[#112030] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
          value={form.eventName}
          onChange={handleChange}
        />
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-[#89e7ff] mb-1">
          Category
        </label>
        <select
          id="category"
          name="categoryId"
          className="w-full rounded-lg border-none bg-[#112030] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
          value={form.categoryId}
          onChange={handleChange}
        >
          {categories.map(category => (
            <option value={category.categoryId} key={category.categoryId}>
              {category.categoryName}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-[#89e7ff] mb-1">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className="w-full rounded-lg border-none bg-[#112030] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
          value={form.description}
          onChange={handleChange}
        />
      </div>

      <div>
        <label htmlFor="image" className="block text-sm font-medium text-[#89e7ff] mb-1">
          Event Image
        </label>
        <input
          type="file"
          id="image"
          name="image"
          accept="image/*"
          className="block w-full text-[#b9cde4] border-none bg-transparent"
          onChange={handleImageChange}
        />
        {form.imagePreview && (
          <div className="mt-2 overflow-hidden rounded-lg bg-[#0f1f2a]">
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

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label htmlFor="startDate" className="block text-sm font-medium text-[#89e7ff] mb-1">
            Start Date/Time
          </label>
          <input
            type="datetime-local"
            id="startDate"
            name="startDate"
            required
            className="w-full rounded-lg border-none bg-[#112030] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
            value={form.startDate}
            onChange={handleChange}
          />
        </div>
        <div className="flex-1">
          <label htmlFor="endDate" className="block text-sm font-medium text-[#89e7ff] mb-1">
            End Date/Time
          </label>
          <input
            type="datetime-local"
            id="endDate"
            name="endDate"
            required
            className="w-full rounded-lg border-none bg-[#112030] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
            value={form.endDate}
            onChange={handleChange}
          />
        </div>
      </div>

      <div>
        <label htmlFor="location" className="block text-sm font-medium text-[#89e7ff] mb-1">
          Location Name
        </label>
        <input
          type="text"
          id="location"
          name="location"
          placeholder="eg. Gulele Stadium"
          required
          className="w-full rounded-lg border-none bg-[#112030] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
          value={form.location}
          onChange={handleChange}
        />
      </div>

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

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label htmlFor="latitude" className="block text-sm font-medium text-[#89e7ff] mb-1">
            Latitude
          </label>
          <input
            type="number"
            name="latitude"
            id="latitude"
            inputMode="decimal"
            step="any"
            placeholder="eg. 9.0455"
            disabled
            className="w-full rounded-lg border-none bg-[#112030] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
            value={form.latitude}
            onChange={handleChange}
          />
        </div>
        <div className="flex-1">
          <label htmlFor="longitude" className="block text-sm font-medium text-[#89e7ff] mb-1">
            Longitude
          </label>
          <input
            type="number"
            name="longitude"
            id="longitude"
            inputMode="decimal"
            step="any"
            disabled
            placeholder="eg. 38.7009"
            className="w-full rounded-lg border-none bg-[#112030] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
            value={form.longitude}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label htmlFor="capacity" className="block text-sm font-medium text-[#89e7ff] mb-1">
            Capacity
          </label>
          <input
            type="number"
            id="capacity"
            name="capacity"
            min="1"
            placeholder="eg. 10"
            className="w-full rounded-lg border-none bg-[#112030] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
            value={form.capacity}
            onChange={handleChange}
          />
        </div>
        <div className="flex-1">
          <label htmlFor="price" className="block text-sm font-medium text-[#89e7ff] mb-1">
            Price (ETB)
          </label>
          <input
            type="number"
            id="price"
            name="price"
            min="0"
            step="any"
            placeholder="eg. 200"
            className="w-full rounded-lg border-none bg-[#112030] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
            value={form.price}
            onChange={handleChange}
          />
        </div>
      </div>
      <div>
        <button
          type="submit"
          className="mt-3 w-full rounded-full bg-linear-to-r from-[#00E5FF] to-[#22FF88] px-6 py-3 text-base font-bold uppercase tracking-wider text-[#001021] transition duration-200 hover:from-[#22FF88] hover:to-[#00E5FF] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00E5FF]/60"
        >
          Create Event
        </button>
      </div>
    </form>
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
