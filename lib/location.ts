export type DecodedLocation = {
  addressLabel: string | null;
  latitude: number | null;
  longitude: number | null;
};

// Format: "{address}!longitude={lng}&latitude={lat}"
export function encodeEventLocation(
  address: string,
  longitude: number,
  latitude: number,
) {
  return `${address}!longitude=${longitude}&latitude=${latitude}`;
}

export function decodeEventLocation(raw?: string | null): DecodedLocation {
  if (!raw || typeof raw !== "string") {
    return { addressLabel: null, latitude: null, longitude: null };
  }

  const [addressPart, coordsPart] = raw.split("!longitude=");
  const addressLabel = addressPart?.trim() || null;

  if (!coordsPart) {
    return { addressLabel, latitude: null, longitude: null };
  }

  const [lngStr, latPart] = coordsPart.split("&latitude=");
  const longitude = Number(lngStr);
  const latitude = Number(latPart);

  return {
    addressLabel,
    longitude: Number.isFinite(longitude) ? longitude : null,
    latitude: Number.isFinite(latitude) ? latitude : null,
  };
}

export function resolveEventLocation(fields: {
  eventLocation?: string | null;
  addressLabel?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): DecodedLocation {
  if (
    typeof fields.addressLabel === "string" ||
    typeof fields.latitude === "number" ||
    typeof fields.longitude === "number"
  ) {
    return {
      addressLabel: fields.addressLabel?.trim() || null,
      latitude: Number.isFinite(fields.latitude) ? fields.latitude ?? null : null,
      longitude: Number.isFinite(fields.longitude) ? fields.longitude ?? null : null,
    };
  }

  return decodeEventLocation(fields.eventLocation);
}

function parseCoordinate(value: number | string) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function prepareEventLocationFields(params: {
  addressLabel: string;
  latitude: number | string;
  longitude: number | string;
}) {
  const addressLabel = params.addressLabel.trim();
  if (!addressLabel) {
    throw new Error("Location is required");
  }

  const latitude = parseCoordinate(params.latitude);
  const longitude = parseCoordinate(params.longitude);

  if (latitude == null || latitude < -90 || latitude > 90) {
    throw new Error("Latitude must be between -90 and 90");
  }
  if (longitude == null || longitude < -180 || longitude > 180) {
    throw new Error("Longitude must be between -180 and 180");
  }

  return {
    addressLabel,
    latitude,
    longitude,
    eventLocation: encodeEventLocation(addressLabel, longitude, latitude),
  };
}

export function haversineDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function boundingBox(
  center: { lat: number; lng: number },
  radiusKm: number,
) {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos(toRad(center.lat)));
  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}
