import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// Ensure L is global for plugins like leaflet.heat in Vite/ESM environments
if (typeof window !== 'undefined') {
    window.L = L;
}
import 'leaflet.heat';

export default function HeatmapLayer({ points }) {
    const map = useMap();

    useEffect(() => {
        console.log("HeatmapLayer points update:", points);
        if (!map || !points || points.length === 0) {
            console.log("HeatmapLayer skipping render: points empty or map not ready");
            return;
        }

        if (!L.heatLayer) {
            console.error('L.heatLayer is still not defined! Plugin failed to attach.');
            return;
        }

        // Leaflet heat requires points in [lat, lng, intensity] format
        const heatLayer = L.heatLayer(points, {
            radius: 35, // More prominent blobs
            blur: 20,
            maxZoom: 17,
            minOpacity: 0.5,
            gradient: {
                0.4: 'yellow',
                0.7: 'orange',
                1.0: 'red'
            }
        }).addTo(map);
        console.log(`Heatmap rendered with ${points.length} points.`);

        return () => {
            map.removeLayer(heatLayer);
        };
    }, [map, points]);

    return null;
}
