import { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { Search } from "lucide-react";
import "leaflet/dist/leaflet.css";

// Fix default marker icon for Vite bundler
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface LocationPickerProps {
  value: { lat: number; lng: number } | null;
  onChange: (coords: { lat: number; lng: number } | null) => void;
}

function DraggableMarker({
  position,
  onDragEnd,
}: {
  position: [number, number];
  onDragEnd: (lat: number, lng: number) => void;
}) {
  const markerRef = useRef<L.Marker>(null);

  useMapEvents({
    click(e) {
      onDragEnd(e.latlng.lat, e.latlng.lng);
    },
  });

  return (
    <Marker
      position={position}
      draggable
      ref={markerRef}
      eventHandlers={{
        dragend() {
          const marker = markerRef.current;
          if (marker) {
            const latlng = marker.getLatLng();
            onDragEnd(latlng.lat, latlng.lng);
          }
        },
      }}
    />
  );
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 15);
  }, [center, map]);
  return null;
}

export default function LocationPicker({
  value,
  onChange,
}: LocationPickerProps) {
  const defaultCenter: [number, number] = [30.3753, 69.3451]; // Pakistan center
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>(
    value ? [value.lat, value.lng] : defaultCenter
  );

  const position: [number, number] = value
    ? [value.lat, value.lng]
    : mapCenter;

  // Debounced Nominatim search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 3) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`,
          {
            headers: { "User-Agent": "PropertyManagement/1.0" },
          }
        );
        const data = await res.json();
        setSearchResults(data);
        setShowResults(true);
      } catch {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleSelectResult = (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    onChange({ lat, lng });
    setMapCenter([lat, lng]);
    setShowResults(false);
    setSearchQuery(result.display_name);
  };

  const handleDragEnd = (lat: number, lng: number) => {
    onChange({ lat, lng });
  };

  return (
    <div className="space-y-2">
      {/* Search */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => searchResults.length > 0 && setShowResults(true)}
          placeholder="Search location..."
          className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />

        {showResults && searchResults.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
            {searchResults.map((r, i) => (
              <button
                key={i}
                onClick={() => handleSelectResult(r)}
                className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
              >
                {r.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="h-64 overflow-hidden rounded-lg border border-gray-300">
        <MapContainer
          center={mapCenter}
          zoom={value ? 15 : 5}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {value && (
            <>
              <DraggableMarker position={position} onDragEnd={handleDragEnd} />
              <MapUpdater center={[value.lat, value.lng]} />
            </>
          )}
          {!value && (
            <ClickToPlace
              onPlace={(lat, lng) => {
                onChange({ lat, lng });
                setMapCenter([lat, lng]);
              }}
            />
          )}
        </MapContainer>
      </div>

      {value && (
        <p className="text-xs text-gray-500">
          Lat: {value.lat.toFixed(6)}, Lng: {value.lng.toFixed(6)} — Click or
          drag marker to adjust
        </p>
      )}
      {!value && (
        <p className="text-xs text-gray-500">
          Click on the map or search to place a pin
        </p>
      )}
    </div>
  );
}

function ClickToPlace({
  onPlace,
}: {
  onPlace: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPlace(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}
