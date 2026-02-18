"use client";
import Image from "next/image";
import React, { useState } from "react";
import { Category } from "../types/catagory";


export default function CreateEventForm({ categories }: { categories: Category[] }) {

 

  const [form, setForm] = useState({
    eventName: "",
    category: categories[0],
    description: "",
    image: null as File | null,
    imagePreview: "",
    startDate: "",
    endDate: "",
    location: "",
    latitude: "",
    longitude: "",
    capacity: "",
    price: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // You can handle submission logic here
    alert("Submit: " + JSON.stringify(form, null, 2));
  };

  return (
    <form
      className="mx-auto max-w-2xl space-y-7 rounded-xl bg-[#18243b] px-6 py-8 shadow-lg"
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
          name="category"
          className="w-full rounded-lg border-none bg-[#112030] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
          value={form.category.categoryId}
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
          className="mt-3 w-full rounded-full bg-gradient-to-r from-[#00E5FF] to-[#22FF88] px-6 py-3 text-base font-bold uppercase tracking-wider text-[#001021] transition duration-200 hover:from-[#22FF88] hover:to-[#00E5FF] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00E5FF]/60"
        >
          Create Event
        </button>
      </div>
    </form>
  );
}
