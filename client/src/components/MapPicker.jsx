import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Crosshair, Check } from 'lucide-react';

// Fix for default marker icon in Leaflet + React
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

function LocationMarker({ position, setPosition }) {
    const map = useMap();

    useMapEvents({
        click(e) {
            setPosition(e.latlng);
            map.flyTo(e.latlng, map.getZoom());
        },
    });

    return position === null ? null : (
        <Marker position={position} />
    );
}

function MapController({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, 15);
        }
    }, [center, map]);
    return null;
}

export default function MapPicker({ onLocationSelect, initialLocation, onClose }) {
    const [position, setPosition] = useState(initialLocation || null);
    const [mapCenter, setMapCenter] = useState(initialLocation || [12.9716, 77.5946]); // Bangalore default
    const [isLocating, setIsLocating] = useState(false);

    const handleLiveLocation = () => {
        setIsLocating(true);
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser");
            setIsLocating(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                const newPos = { lat: latitude, lng: longitude };
                setPosition(newPos);
                setMapCenter([latitude, longitude]);
                setIsLocating(false);
            },
            (error) => {
                console.error("Error getting location:", error);
                alert("Unable to retrieve your location");
                setIsLocating(false);
            }
        );
    };

    const handleConfirm = () => {
        if (position) {
            onLocationSelect(position);
            onClose();
        }
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between">
                <div>
                    <h3 className="font-heading font-bold text-slate-800 flex items-center gap-2">
                        <MapPin size={18} className="text-primary-600" />
                        Pin Location
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select where the issue is occurring</p>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                >
                    <Check size={20} />
                </button>
            </div>

            <div className="flex-1 relative group">
                <MapContainer
                    center={mapCenter}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom={true}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <LocationMarker position={position} setPosition={setPosition} />
                    <MapController center={mapCenter} />
                </MapContainer>

                {/* Overlays */}
                <div className="absolute top-4 right-4 z-1000 flex flex-col gap-2">
                    <button
                        onClick={handleLiveLocation}
                        disabled={isLocating}
                        className="bg-white p-3 rounded-xl shadow-lg border border-slate-200 text-primary-600 hover:bg-primary-50 transition-all flex items-center justify-center disabled:opacity-50 group/btn"
                        title="Use Live Location"
                    >
                        <Crosshair size={20} className={isLocating ? "animate-spin" : "group-hover/btn:scale-110 transition-transform"} />
                    </button>
                </div>

                {!position && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-1000">
                        <div className="bg-slate-900/80 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-bold animate-pulse">
                            Tap anywhere on map to drop a pin
                        </div>
                    </div>
                )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-200">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Selected Coordinates</span>
                        <div className="text-xs font-mono font-bold text-slate-700 bg-white px-3 py-2 rounded-lg border border-slate-200 flex items-center gap-2">
                            {position ? (
                                <>
                                    <span className="text-primary-600">LAT:</span> {position.lat.toFixed(6)}
                                    <span className="ml-2 text-primary-600">LNG:</span> {position.lng.toFixed(6)}
                                </>
                            ) : (
                                <span className="text-slate-400 italic">No location selected</span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={handleConfirm}
                        disabled={!position}
                        className="px-8 py-3.5 bg-primary-600 text-white rounded-xl font-bold text-sm hover:bg-primary-700 disabled:opacity-50 transition-all shadow-lg shadow-primary-200 flex items-center gap-2 transform active:scale-95"
                    >
                        <Check size={18} />
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}
