import { describe, expect, it } from "vitest";
import {
  boundingBox,
  buildGoogleMapsUrl,
  decodeEventLocation,
  encodeEventLocation,
  haversineDistanceKm,
  prepareEventLocationFields,
  resolveEventLocation,
} from "@/lib/location";

describe("location helpers", () => {
  it("encodes and decodes legacy event location strings", () => {
    const encoded = encodeEventLocation("Bole Atlas", 38.786, 8.997);
    expect(encoded).toBe("Bole Atlas!longitude=38.786&latitude=8.997");

    expect(decodeEventLocation(encoded)).toEqual({
      addressLabel: "Bole Atlas",
      longitude: 38.786,
      latitude: 8.997,
    });
  });

  it("handles missing or malformed encoded locations", () => {
    expect(decodeEventLocation(null)).toEqual({
      addressLabel: null,
      latitude: null,
      longitude: null,
    });

    expect(decodeEventLocation("Venue only")).toEqual({
      addressLabel: "Venue only",
      latitude: null,
      longitude: null,
    });

    expect(decodeEventLocation("Venue!longitude=bad&latitude=nope")).toEqual({
      addressLabel: "Venue",
      latitude: null,
      longitude: null,
    });
  });

  it("prefers modern discrete location fields when present", () => {
    expect(
      resolveEventLocation({
        eventLocation: "Old Venue!longitude=1&latitude=2",
        addressLabel: "New Venue",
        latitude: 9.01,
        longitude: 38.76,
      }),
    ).toEqual({
      addressLabel: "New Venue",
      latitude: 9.01,
      longitude: 38.76,
    });
  });

  it("falls back to the legacy event location when discrete fields are absent", () => {
    expect(
      resolveEventLocation({
        eventLocation: "Legacy Venue!longitude=38.7&latitude=9.0",
      }),
    ).toEqual({
      addressLabel: "Legacy Venue",
      latitude: 9,
      longitude: 38.7,
    });
  });

  it("validates and prepares event location fields", () => {
    expect(
      prepareEventLocationFields({
        addressLabel: "  Addis Arena  ",
        latitude: "9.01",
        longitude: "38.76",
      }),
    ).toEqual({
      addressLabel: "Addis Arena",
      latitude: 9.01,
      longitude: 38.76,
      eventLocation: "Addis Arena!longitude=38.76&latitude=9.01",
    });

    expect(() =>
      prepareEventLocationFields({
        addressLabel: " ",
        latitude: "9.01",
        longitude: "38.76",
      }),
    ).toThrow("Location is required");

    expect(() =>
      prepareEventLocationFields({
        addressLabel: "Addis Arena",
        latitude: 91,
        longitude: 38.76,
      }),
    ).toThrow("Latitude must be between -90 and 90");

    expect(() =>
      prepareEventLocationFields({
        addressLabel: "Addis Arena",
        latitude: 9.01,
        longitude: -181,
      }),
    ).toThrow("Longitude must be between -180 and 180");
  });

  it("computes distances and bounding boxes", () => {
    const distance = haversineDistanceKm(
      { lat: 9.01, lng: 38.76 },
      { lat: 9.02, lng: 38.77 },
    );
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(5);

    const box = boundingBox({ lat: 9.01, lng: 38.76 }, 10);
    expect(box.minLat).toBeLessThan(9.01);
    expect(box.maxLat).toBeGreaterThan(9.01);
    expect(box.minLng).toBeLessThan(38.76);
    expect(box.maxLng).toBeGreaterThan(38.76);
  });

  it("builds Google Maps URLs from coordinates or an address", () => {
    expect(
      buildGoogleMapsUrl({
        latitude: 9.01,
        longitude: 38.76,
      }),
    ).toBe("https://www.google.com/maps/search/?api=1&query=9.01%2C38.76");

    expect(
      buildGoogleMapsUrl({
        addressLabel: "Bole Atlas, Addis Ababa",
      }),
    ).toBe(
      "https://www.google.com/maps/search/?api=1&query=Bole%20Atlas%2C%20Addis%20Ababa",
    );

    expect(buildGoogleMapsUrl({})).toBeNull();
  });
});
