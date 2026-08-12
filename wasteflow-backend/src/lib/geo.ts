export type GeoFix = {
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  capturedAt: string;
  error?: string;
};

export async function captureGeo(timeoutMs = 8000): Promise<GeoFix> {
  const capturedAt = new Date().toISOString();
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { latitude: null, longitude: null, accuracy_m: null, capturedAt, error: "Geolocation unavailable" };
  }
  return new Promise<GeoFix>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy_m: pos.coords.accuracy ? Number(pos.coords.accuracy.toFixed(1)) : null,
          capturedAt: new Date().toISOString(),
        }),
      (err) =>
        resolve({
          latitude: null,
          longitude: null,
          accuracy_m: null,
          capturedAt,
          error: err.message || "Location permission denied",
        }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 15000 },
    );
  });
}
