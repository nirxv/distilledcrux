'use client';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { useEffect, useCallback, useRef } from 'react';
import { GeoMapEntry } from '@/lib/geoMapData';
import 'leaflet/dist/leaflet.css';

const INDIA_BOUNDS: [[number, number], [number, number]] = [[7.067, 56.787],[37.193, 102.996]];
const ACCENT = '#4361ee';

function FitBounds({ entries, selectedName, disableAutoZoom }: { entries: GeoMapEntry[]; selectedName: string | null; disableAutoZoom?: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (disableAutoZoom) { map.fitBounds(INDIA_BOUNDS, { padding: [10, 10] }); return; }
    if (selectedName) {
      const target = entries.find(e => e.name === selectedName);
      if (target) { map.flyTo([target.lat, target.lng], 6, { duration: 0.6 }); return; }
    }
    if (entries.length === 0) { map.fitBounds(INDIA_BOUNDS, { padding: [10, 10] }); return; }
    if (entries.length === 1) { map.setView([entries[0].lat, entries[0].lng], 6); return; }
    const lats = entries.map(e => e.lat);
    const lngs = entries.map(e => e.lng);
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lats) - 1, Math.min(...lngs) - 1],
      [Math.max(...lats) + 1, Math.max(...lngs) + 1],
    ];
    map.fitBounds(bounds, { padding: [20, 20] });
  }, [map, entries, selectedName, disableAutoZoom]);
  return null;
}

function GraticuleGrid() {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mapContainer = map.getContainer();
    const w = mapContainer.clientWidth, h = mapContainer.clientHeight;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    const LINE = 'rgba(0,0,0,0.7)', LABEL = 'rgba(0,0,0,0.9)', FONT = 'bold 8px monospace';
    for (let lat = 8; lat <= 36; lat += 4) {
      const p1 = map.latLngToContainerPoint([lat, 60]), p2 = map.latLngToContainerPoint([lat, 104]);
      ctx.beginPath(); ctx.lineWidth = 0.8; ctx.strokeStyle = LINE; ctx.setLineDash([]);
      ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      ctx.font = FONT; ctx.fillStyle = LABEL; ctx.textBaseline = 'middle';
      ctx.textAlign = 'left'; ctx.fillText(`${lat}N`, 3, p1.y);
      ctx.textAlign = 'right'; ctx.fillText(`${lat}N`, w - 3, p1.y);
    }
    for (let lng = 60; lng <= 104; lng += 4) {
      const p1 = map.latLngToContainerPoint([36, lng]), p2 = map.latLngToContainerPoint([8, lng]);
      ctx.beginPath(); ctx.lineWidth = 0.8; ctx.strokeStyle = LINE; ctx.setLineDash([]);
      ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      ctx.font = FONT; ctx.fillStyle = LABEL;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(`${lng}E`, p1.x, 2);
      ctx.textBaseline = 'bottom'; ctx.fillText(`${lng}E`, p2.x, h - 2);
    }
    const tc1 = map.latLngToContainerPoint([23.5, 60]), tc2 = map.latLngToContainerPoint([23.5, 104]);
    ctx.beginPath(); ctx.setLineDash([8, 4]); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.moveTo(tc1.x, tc1.y); ctx.lineTo(tc2.x, tc2.y); ctx.stroke();
    ctx.setLineDash([]); ctx.font = 'bold 7px monospace'; ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.textBaseline = 'bottom'; ctx.textAlign = 'left';
    ctx.fillText('Tropic of Cancer (23.5N)', tc1.x + 4, tc1.y - 2);
  }, [map]);
  useEffect(() => {
    const mapContainer = map.getContainer();
    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:450;';
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;top:0;left:0;';
    div.appendChild(canvas); mapContainer.appendChild(div); canvasRef.current = canvas;
    redraw(); map.on('move zoom moveend zoomend resize', redraw);
    return () => { map.off('move zoom moveend zoomend resize', redraw); if (mapContainer.contains(div)) mapContainer.removeChild(div); canvasRef.current = null; };
  }, [map, redraw]);
  return null;
}

export default function GeoMappingMap({ entries, selectedName, onEntryClick, noLabels = false, showGrid = false, disableAutoZoom = false }: {
  entries: GeoMapEntry[]; selectedName: string | null; onEntryClick: (name: string) => void;
  noLabels?: boolean; showGrid?: boolean; disableAutoZoom?: boolean;
}) {
  const tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png';
  return (
    <div style={{ width: '100%', height: 420, border: '1.5px solid var(--border2)', borderRadius: 10, overflow: 'hidden', position: 'relative', zIndex: 0 }}>
      <MapContainer key={noLabels ? 'nl' : 'l'} bounds={INDIA_BOUNDS} style={{ width: '100%', height: '100%', background: 'var(--bg2)' }} zoomControl={true} scrollWheelZoom={true} attributionControl={false}>
        <TileLayer url={tileUrl} attribution="&copy; OpenStreetMap &copy; CARTO" />
        <FitBounds entries={entries} selectedName={selectedName} disableAutoZoom={disableAutoZoom} />
        {showGrid && <GraticuleGrid />}
        {entries.map((entry) => {
          const isSelected = selectedName === entry.name;
          return (
            <CircleMarker key={`${entry.year}-${entry.number}`} center={[entry.lat, entry.lng]} radius={isSelected ? 9 : 5}
              pathOptions={{ fillColor: isSelected ? '#ffffff' : ACCENT, fillOpacity: 1, color: isSelected ? ACCENT : 'rgba(255,255,255,0.7)', weight: isSelected ? 3 : 1.5 }}
              eventHandlers={{ click: () => onEntryClick(entry.name) }}>
              {!noLabels && (
                <Tooltip direction="top" offset={[0, -6]} className="geo-mapping-tooltip">
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12 }}>
                    <strong>{entry.name}</strong>
                    <div style={{ color: '#aaa', fontSize: 11 }}>{entry.year} · Q{entry.number}</div>
                  </div>
                </Tooltip>
              )}
            </CircleMarker>
          );
        })}
      </MapContainer>
      <style>{`.geo-mapping-tooltip { background: var(--bg3) !important; border: 1px solid var(--border2) !important; color: var(--text) !important; border-radius: 6px !important; padding: 6px 10px !important; } .leaflet-container { font-family: var(--font-ui) !important; }`}</style>
    </div>
  );
}
