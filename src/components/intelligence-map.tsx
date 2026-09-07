"use client";

import { useEffect, useRef, useState } from "react";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/dark";

type IntelligenceMapProps = {
  showEarthquakes: boolean;
  showFlights: boolean;
  showMaritime: boolean;
  showSatellites: boolean;
};

type Point = {
  id: string;
  lng: number;
  lat: number;
  label: string;
  kind: string;
  detail?: string;
  magnitude?: number;
};

type GeoJsonFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Record<string, string | number | null>;
};

function toPoint(item: any, index: number, kind: string): Point | null {
  const lat = Number(item?.lat ?? item?.latitude);
  const lng = Number(item?.lng ?? item?.lon ?? item?.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  const magnitude = Number(item?.magnitude);
  const label =
    item?.place ??
    item?.name ??
    item?.callsign ??
    item?.icao24 ??
    item?.mmsi ??
    `${kind} ${index + 1}`;

  const detail =
    kind === "earthquake"
      ? `M${Number.isFinite(magnitude) ? magnitude.toFixed(1) : "?"} · ${item?.depth ?? "?"} km depth`
      : item?.model ?? item?.destination ?? item?.flag ?? item?.type ?? undefined;

  return {
    id: String(item?.id ?? item?.icao24 ?? item?.mmsi ?? `${kind}-${index}`),
    lng,
    lat,
    label: String(label),
    kind,
    detail: detail ? String(detail) : undefined,
    magnitude: Number.isFinite(magnitude) ? magnitude : undefined,
  };
}

function toFeature(point: Point): GeoJsonFeature {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [point.lng, point.lat] },
    properties: {
      id: point.id,
      label: point.label,
      kind: point.kind,
      detail: point.detail ?? "",
      magnitude: point.magnitude ?? 0,
    },
  };
}

export default function IntelligenceMap({
  showEarthquakes,
  showFlights,
  showMaritime,
  showSatellites,
}: IntelligenceMapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [status, setStatus] = useState("Initializing map");
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function createMap() {
      if (!mapContainer.current || mapRef.current) return;

      const maplibregl = await import("maplibre-gl");
      if (cancelled || !mapContainer.current) return;

      const map = new maplibregl.Map({
        container: mapContainer.current,
        style: MAP_STYLE,
        center: [10, 25],
        zoom: 1.35,
        minZoom: 1,
        maxZoom: 12,
        attributionControl: false,
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
      mapRef.current = map;

      map.on("load", () => {
        map.addSource("earthquakes", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        map.addLayer({
          id: "earthquake-glow",
          type: "circle",
          source: "earthquakes",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["get", "magnitude"], 2.5, 5, 5, 9, 7, 14],
            "circle-color": "#ff5c5c",
            "circle-opacity": 0.18,
            "circle-blur": 0.8,
          },
        });

        map.addLayer({
          id: "earthquake-points",
          type: "circle",
          source: "earthquakes",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["get", "magnitude"], 2.5, 3, 5, 5, 7, 8],
            "circle-color": [
              "interpolate",
              ["linear"],
              ["get", "magnitude"],
              2.5,
              "#ffd166",
              5,
              "#ff8c42",
              7,
              "#ff3d5a",
            ],
            "circle-stroke-color": "#fff4f4",
            "circle-stroke-width": 1,
            "circle-opacity": 0.95,
          },
        });

        map.addSource("flights", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        map.addLayer({
          id: "flight-points",
          type: "circle",
          source: "flights",
          paint: {
            "circle-radius": 3,
            "circle-color": "#5ee7ff",
            "circle-stroke-color": "#07131f",
            "circle-stroke-width": 1,
            "circle-opacity": 0.85,
          },
        });

        map.addSource("maritime", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        map.addLayer({
          id: "maritime-points",
          type: "circle",
          source: "maritime",
          paint: {
            "circle-radius": 3.5,
            "circle-color": "#3da9ff",
            "circle-stroke-color": "#06111c",
            "circle-stroke-width": 1,
            "circle-opacity": 0.85,
          },
        });

        map.addSource("satellites", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        map.addLayer({
          id: "satellite-points",
          type: "circle",
          source: "satellites",
          paint: {
            "circle-radius": 3,
            "circle-color": "#d56cff",
            "circle-opacity": 0.85,
          },
        });

        const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true });

        for (const layerId of ["earthquake-points", "flight-points", "maritime-points", "satellite-points"]) {
          map.on("click", layerId, (event: any) => {
            const feature = event.features?.[0];
            if (!feature) return;
            const properties = feature.properties ?? {};
            popup
              .setLngLat(event.lngLat)
              .setHTML(
                `<div style="font-family:system-ui;min-width:180px"><strong>${String(properties.label ?? "Intel event")}</strong><div style="margin-top:5px;font-size:12px;opacity:.75">${String(properties.kind ?? "OSIRIS")}</div><div style="margin-top:5px;font-size:12px">${String(properties.detail ?? "Live OSIRIS data")}</div></div>`,
              )
              .addTo(map);
          });

          map.on("mouseenter", layerId, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layerId, () => {
            map.getCanvas().style.cursor = "";
          });
        }

        setStatus("Connected to ARI intelligence map");
      });
    }

    createMap().catch((error) => {
      console.error("MapLibre initialization failed:", error);
      if (!cancelled) setStatus("Map initialization failed");
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const visibility = (enabled: boolean) => (enabled ? "visible" : "none");
    for (const id of ["earthquake-glow", "earthquake-points"]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visibility(showEarthquakes));
    }
    if (map.getLayer("flight-points")) map.setLayoutProperty("flight-points", "visibility", visibility(showFlights));
    if (map.getLayer("maritime-points")) map.setLayoutProperty("maritime-points", "visibility", visibility(showMaritime));
    if (map.getLayer("satellite-points")) map.setLayoutProperty("satellite-points", "visibility", visibility(showSatellites));
  }, [showEarthquakes, showFlights, showMaritime, showSatellites]);

  useEffect(() => {
    let cancelled = false;

    async function loadFeeds() {
      const map = mapRef.current;
      if (!map) return;

      const requests: Array<[string, string, boolean]> = [
        ["earthquakes", "/api/intelligence/feed/earthquakes", showEarthquakes],
        ["flights", "/api/intelligence/feed/flights", showFlights],
        ["maritime", "/api/intelligence/feed/maritime", showMaritime],
        ["satellites", "/api/intelligence/feed/satellites", showSatellites],
      ];

      await Promise.all(
        requests.map(async ([sourceId, url, enabled]) => {
          if (!enabled) return;

          try {
            const response = await fetch(url, { cache: "no-store" });
            if (!response.ok) throw new Error(`${sourceId} unavailable`);
            const data = await response.json();
            let points: Point[] = [];

            if (sourceId === "earthquakes") {
              points = (Array.isArray(data.earthquakes) ? data.earthquakes : [])
                .map((item: any, index: number) => toPoint(item, index, "earthquake"))
                .filter(Boolean) as Point[];
            } else if (sourceId === "flights") {
              const flights = [
                ...(data.commercial_flights ?? []),
                ...(data.private_flights ?? []),
                ...(data.private_jets ?? []),
                ...(data.military_flights ?? []),
              ];
              points = flights
                .map((item: any, index: number) => toPoint(item, index, "flight"))
                .filter(Boolean) as Point[];
            } else if (sourceId === "maritime") {
              const ships = data.ships ?? data.maritime_ships ?? [];
              points = ships
                .map((item: any, index: number) => toPoint(item, index, "maritime"))
                .filter(Boolean) as Point[];
            } else if (sourceId === "satellites") {
              const satellites = data.satellites ?? [];
              points = satellites
                .map((item: any, index: number) => toPoint(item, index, "satellite"))
                .filter(Boolean) as Point[];
            }

            const geojson = {
              type: "FeatureCollection" as const,
              features: points.map(toFeature),
            };

            const source = map.getSource(sourceId) as any;
            source?.setData(geojson);
          } catch (error) {
            console.error(`Failed to load ${sourceId}:`, error);
          }
        }),
      );

      if (!cancelled) setLastUpdate(new Date().toLocaleTimeString());
    }

    const interval = window.setInterval(loadFeeds, 60_000);
    loadFeeds();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [showEarthquakes, showFlights, showMaritime, showSatellites]);

  return (
    <div className="absolute inset-0">
      <div ref={mapContainer} className="h-full w-full" />

      <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-lg border border-[#55e7ff]/20 bg-[#071827]/80 px-3 py-2 text-[10px] text-[#b8dbea] shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#35d77c]" />
          {status}
        </div>
        {lastUpdate && <div className="mt-1 text-[#7696aa]">Feeds updated {lastUpdate}</div>}
      </div>
    </div>
  );
}
