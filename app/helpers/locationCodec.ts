type DecodedLocation = {
  addressLabel: string | null;
  latitude: number | null;
  longitude: number | null;
};

// Format: "{address}!longitude={lng}&latitude={lat}"
export function encodeEventLocation(address: string, longitude: number, latitude: number) {
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

export function haversineDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371; // km
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

export type { DecodedLocation };
