import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin } from "lucide-react";

const MAPBOX_TOKEN =
  (import.meta as any).env?.VITE_MAPBOX_TOKEN?.trim?.() ||
  (typeof process !== "undefined" ? process.env?.VITE_MAPBOX_TOKEN?.trim?.() : "") ||
  "";

// Tirupati default center
const DEFAULT = { lat: 13.6288, lng: 79.4192 };

type Suggestion = {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
};

export type MapboxLocationValue = {
  latitude: number | null;
  longitude: number | null;
  address?: string;
};

type Props = {
  latitude: number | null;
  longitude: number | null;
  onChange: (value: MapboxLocationValue) => void;
  /** When true, selecting a search result also fills address text via onChange.address */
  fillAddress?: boolean;
  className?: string;
};

export function MapboxLocationPicker({
  latitude,
  longitude,
  onChange,
  fillAddress = true,
  className,
}: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [openSug, setOpenSug] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mapFailed, setMapFailed] = useState(false);

  const hasToken = Boolean(MAPBOX_TOKEN);

  const lat = latitude != null && Number.isFinite(latitude) ? latitude : DEFAULT.lat;
  const lng = longitude != null && Number.isFinite(longitude) ? longitude : DEFAULT.lng;

  useEffect(() => {
    if (!hasToken || !mapContainer.current || mapRef.current || mapFailed) return;

    try {
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [lng, lat],
        zoom: 14,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

      const marker = new mapboxgl.Marker({ draggable: true, color: "#ea580c" })
        .setLngLat([lng, lat])
        .addTo(map);

      marker.on("dragend", () => {
        const pos = marker.getLngLat();
        onChange({
          latitude: Number(pos.lat.toFixed(6)),
          longitude: Number(pos.lng.toFixed(6)),
        });
      });

      map.on("click", (e) => {
        marker.setLngLat(e.lngLat);
        onChange({
          latitude: Number(e.lngLat.lat.toFixed(6)),
          longitude: Number(e.lngLat.lng.toFixed(6)),
        });
      });

      map.on("error", () => setMapFailed(true));

      map.on("load", () => {
        map.resize();
      });

      // Dialog/layout may mount with 0 size — resize shortly after
      const t1 = window.setTimeout(() => map.resize(), 100);
      const t2 = window.setTimeout(() => map.resize(), 400);

      mapRef.current = map;
      markerRef.current = marker;

      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
        try {
          marker.remove();
          map.remove();
        } catch {
          /* ignore */
        }
        mapRef.current = null;
        markerRef.current = null;
      };
    } catch (err) {
      console.error(err);
      setMapFailed(true);
    }
    // init once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken, mapFailed]);

  // Sync external lat/lng into map/marker
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    if (latitude == null || longitude == null) return;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    const cur = markerRef.current.getLngLat();
    if (Math.abs(cur.lat - latitude) < 1e-6 && Math.abs(cur.lng - longitude) < 1e-6) return;
    markerRef.current.setLngLat([longitude, latitude]);
    mapRef.current.flyTo({ center: [longitude, latitude], zoom: Math.max(mapRef.current.getZoom(), 14) });
  }, [latitude, longitude]);

  useEffect(() => {
    if (!hasToken) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const url =
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query.trim())}.json` +
          `?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=6&country=in&types=address,poi,place,locality,neighborhood`;
        const res = await fetch(url);
        const json = await res.json();
        const feats = (json?.features ?? []) as any[];
        setSuggestions(
          feats.map((f) => ({
            id: f.id,
            place_name: f.place_name as string,
            center: f.center as [number, number],
          })),
        );
        setOpenSug(true);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, hasToken]);

  function pickSuggestion(s: Suggestion) {
    const [pickLng, pickLat] = s.center;
    setQuery(s.place_name);
    setOpenSug(false);
    setSuggestions([]);
    onChange({
      latitude: Number(pickLat.toFixed(6)),
      longitude: Number(pickLng.toFixed(6)),
      ...(fillAddress ? { address: s.place_name } : {}),
    });
    markerRef.current?.setLngLat([pickLng, pickLat]);
    mapRef.current?.flyTo({ center: [pickLng, pickLat], zoom: 15 });
  }

  if (!hasToken || mapFailed) {
    return (
      <div className={`space-y-2 rounded-lg border border-dashed p-4 ${className ?? ""}`}>
        <Label>Location on map</Label>
        <p className="text-sm text-muted-foreground">
          {mapFailed
            ? "Map couldn’t load in this browser. Enter latitude / longitude below."
            : (
              <>
                Add <code className="rounded bg-muted px-1">VITE_MAPBOX_TOKEN</code> to your ERP{" "}
                <code className="rounded bg-muted px-1">.env</code> (and Vercel env), then redeploy. Until then you can
                still type latitude / longitude below.
              </>
            )}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="manual-lat">Latitude</Label>
            <Input
              id="manual-lat"
              inputMode="decimal"
              value={latitude ?? ""}
              onChange={(e) =>
                onChange({
                  latitude: e.target.value ? Number(e.target.value) : null,
                  longitude,
                })
              }
              placeholder="13.6288"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-lng">Longitude</Label>
            <Input
              id="manual-lng"
              inputMode="decimal"
              value={longitude ?? ""}
              onChange={(e) =>
                onChange({
                  latitude,
                  longitude: e.target.value ? Number(e.target.value) : null,
                })
              }
              placeholder="79.4192"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>Location on map</Label>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground">
          <MapPin className="size-4" />
        </div>
        <Input
          className="pl-9"
          placeholder="Search place, street, or landmark…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length && setOpenSug(true)}
          onBlur={() => setTimeout(() => setOpenSug(false), 180)}
          autoComplete="off"
        />
        {searching ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Searching…</span>
        ) : null}
        {openSug && suggestions.length > 0 ? (
          <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickSuggestion(s)}
                >
                  {s.place_name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div ref={mapContainer} className="h-56 w-full overflow-hidden rounded-lg border sm:h-64" />

      <p className="text-xs text-muted-foreground">
        Search a place, or drag the pin / click the map. Saved as{" "}
        <span className="font-mono">
          {latitude != null && longitude != null
            ? `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`
            : "not set yet"}
        </span>
      </p>
    </div>
  );
}
