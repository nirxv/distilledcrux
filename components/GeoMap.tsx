'use client';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Polyline, Tooltip, Pane, useMap, useMapEvents } from 'react-leaflet';
import type { GeoJsonObject } from 'geojson';
import { physicalBasemap, politicalBasemap } from '@/lib/basemap';
import 'leaflet/dist/leaflet.css';

/** Political: tiles with state lines. Physical: relief and rivers. Outline: the exam's plain map. */
export type MapBase = 'political' | 'physical' | 'outline';

/** A place on the map. `num` draws it as a numbered dot, as a paper's places are listed. */
export type MapPlace = { id: string; name: string; lat: number; lng: number; num?: number; sub?: string };

/**
 * Where the reader marked a place, in a test. Once checked it carries the
 * place's real position, and a dashed line joins the two.
 */
export type MapMark = { id: string; lat: number; lng: number; num?: number; truth?: { lat: number; lng: number }; tone?: 'right' | 'close' | 'off' };

const INDIA_BOUNDS: [[number, number], [number, number]] = [[7.067, 56.787], [37.193, 102.996]];

// Fetched once per visit and shared by every map on the page.
let statesP: Promise<GeoJsonObject | null> | null = null;
let outlineP: Promise<GeoJsonObject | null> | null = null;
const fetchJson = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
function useGeo(kind: 'states' | 'outline', on: boolean) {
  const [data, setData] = useState<GeoJsonObject | null>(null);
  useEffect(() => {
    if (!on) return;
    const p = kind === 'states' ? (statesP ??= fetchJson('/india_states.geojson')) : (outlineP ??= fetchJson('/india_outline.geojson'));
    let live = true;
    p.then((d) => { if (live) setData(d); });
    return () => { live = false; };
  }, [kind, on]);
  return on ? data : null;
}

/**
 * Frames the map: every place in view, the picked one flown to, or the whole
 * of India (the quiz, and a test, where the frame must not hint at anything).
 * Redone when the frame changes size, as when a phone turns.
 */
function Frame({ places, selected, fixed }: { places: MapPlace[]; selected: string | null; fixed?: boolean }) {
  const map = useMap();
  const fit = useCallback(() => {
    if (fixed || places.length === 0) { map.fitBounds(INDIA_BOUNDS, { padding: [10, 10] }); return; }
    if (places.length === 1) { map.setView([places[0].lat, places[0].lng], 6); return; }
    const lats = places.map((p) => p.lat), lngs = places.map((p) => p.lng);
    map.fitBounds([[Math.min(...lats) - 1, Math.min(...lngs) - 1], [Math.max(...lats) + 1, Math.max(...lngs) + 1]], { padding: [20, 20] });
  }, [map, places, fixed]);
  useEffect(() => {
    const target = !fixed && selected ? places.find((p) => p.id === selected) : undefined;
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 5), { duration: 0.6 });
    else fit();
    // Only a new set of places or a new pick reframes the map; a test's marks don't.
  }, [map, places.length, selected, fixed]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/** Lines of latitude and longitude every 4°, and the Tropic of Cancer, as on the exam's outline map. */
function Graticule() {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const box = map.getContainer();
    const w = box.clientWidth, h = box.clientHeight;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.font = '600 9px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 0.8;
    for (let lat = 8; lat <= 36; lat += 4) {
      const a = map.latLngToContainerPoint([lat, 60]), b = map.latLngToContainerPoint([lat, 104]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(`${lat}°N`, 3, a.y);
      ctx.textAlign = 'right'; ctx.fillText(`${lat}°N`, w - 3, a.y);
    }
    for (let lng = 60; lng <= 104; lng += 4) {
      const a = map.latLngToContainerPoint([36, lng]), b = map.latLngToContainerPoint([8, lng]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(`${lng}°E`, a.x, 2);
      ctx.textBaseline = 'bottom'; ctx.fillText(`${lng}°E`, b.x, h - 2);
    }
    const t1 = map.latLngToContainerPoint([23.5, 60]), t2 = map.latLngToContainerPoint([23.5, 104]);
    ctx.beginPath(); ctx.setLineDash([8, 4]); ctx.lineWidth = 1.2; ctx.moveTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.textBaseline = 'bottom'; ctx.textAlign = 'left'; ctx.fillText('Tropic of Cancer (23½°N)', t1.x + 4, t1.y - 2);
  }, [map]);
  useEffect(() => {
    const box = map.getContainer();
    const layer = document.createElement('div');
    layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:450;';
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;top:0;left:0;';
    layer.appendChild(canvas); box.appendChild(layer); canvasRef.current = canvas;
    redraw();
    map.on('move zoom moveend zoomend resize', redraw);
    return () => { map.off('move zoom moveend zoomend resize', redraw); layer.remove(); canvasRef.current = null; };
  }, [map, redraw]);
  return null;
}

/** Taps on the map, for marking a place in a test. */
function Tap({ onMark }: { onMark: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onMark(e.latlng.lat, e.latlng.lng) });
  return null;
}

/**
 * The Geography map. Places are dots in the optional's colour, the picked one
 * white ringed in it; a paper's places are numbered dots. The base is the
 * political map (tiles and state lines), the physical map (relief and rivers,
 * no names) or the plain outline the exam is printed on. With `onMark` a tap
 * marks a place, for testing yourself the way the paper asks: the name is
 * given, and you mark where it is. Dot colours come from classes, since a CSS
 * variable in an SVG attribute is not read by every browser, and each dot has
 * a wider, invisible ring around it to be easy to tap.
 */
export default function GeoMap({ places, selected = null, onPick, base = 'political', grid = false, fixed = false, quiet = false, onMark, marks = [] }: {
  places: MapPlace[];
  selected?: string | null;
  onPick?: (id: string) => void;
  base?: MapBase;
  grid?: boolean;
  /** Keep India in frame whatever is picked (the quiz, a test). */
  fixed?: boolean;
  /** No names on hover (the quiz, a test). */
  quiet?: boolean;
  onMark?: (lat: number, lng: number) => void;
  marks?: MapMark[];
}) {
  const plain = base === 'outline';
  const states = useGeo('states', base === 'political');
  const shape = useGeo('outline', base !== 'political');
  const tiles = base === 'physical' ? physicalBasemap : politicalBasemap;
  const pick = (id: string) => onPick?.(id);
  return (
    <div className={`gm${plain ? ' plain' : ''}${onMark ? ' marking' : ''}`}>
      <MapContainer key={base} bounds={INDIA_BOUNDS} style={{ width: '100%', height: '100%' }}
        zoomControl scrollWheelZoom={false} attributionControl={false}>
        {/* Shapes arrive after the dots; in the dots' own layer they would be drawn over them. */}
        <Pane name="shapes" style={{ zIndex: 350 }}>
          {plain ? (
            shape && <GeoJSON data={shape} interactive={false} style={(f) => {
              const india = f?.properties?.name === 'India';
              return { fillColor: india ? '#fbf8f2' : '#ebe7de', fillOpacity: 1, color: '#3a3a3a', weight: india ? 1.4 : 0.7 };
            }} />
          ) : base === 'physical' ? (
            // The relief has no borders of its own: the countries' outlines, unfilled.
            shape && <GeoJSON data={shape} interactive={false} style={() => ({ fill: false, className: 'gm-border', weight: 1 })} />
          ) : (
            states && <GeoJSON data={states} interactive={false} style={() => ({ fill: false, color: '#8a8a8a', weight: 1, opacity: 0.7 })} />
          )}
        </Pane>
        {!plain && <TileLayer url={tiles.url} maxNativeZoom={tiles.maxNativeZoom} maxZoom={19} attribution={tiles.attribution} />}
        <Frame places={places} selected={selected} fixed={fixed} />
        {grid && <Graticule />}
        {onMark && <Tap onMark={onMark} />}
        {marks.map((m) => (
          <Fragment key={`mark-${m.id}`}>
            {m.truth && <Polyline key={`line-${m.id}-${m.tone ?? ''}`} positions={[[m.lat, m.lng], [m.truth.lat, m.truth.lng]]} className={`gm-line ${m.tone ?? ''}`} pathOptions={{ weight: 2, dashArray: '5 5' }} interactive={false} />}
            <CircleMarker key={`mark-${m.id}-${m.tone ?? 'open'}`} center={[m.lat, m.lng]} radius={7}
              className={`gm-mark ${m.tone ?? 'open'}`} pathOptions={{ fillOpacity: 1, weight: 2 }} interactive={false}>
              {/* Once checked, the place's own numbered dot carries the number. */}
              {m.num != null && !m.truth && <Tooltip permanent direction="right" offset={[6, 0]} className="gm-mark-n">{m.num}</Tooltip>}
            </CircleMarker>
          </Fragment>
        ))}
        {places.map((p) => {
          const on = selected === p.id;
          return (
            <Fragment key={p.id}>
              <CircleMarker center={[p.lat, p.lng]} radius={p.num != null ? 18 : 16} className="gm-hit" pathOptions={{ weight: 0 }} eventHandlers={{ click: () => pick(p.id) }}>
                {!quiet && (
                  <Tooltip direction="top" offset={[0, -8]} className="gm-tip">
                    <strong>{p.num != null ? `${p.num}. ` : ''}{p.name}</strong>
                    {p.sub && <span>{p.sub}</span>}
                  </Tooltip>
                )}
              </CircleMarker>
              {p.num != null ? (
                <CircleMarker key={`${p.id}-${on}`} center={[p.lat, p.lng]} radius={on ? 13 : 10}
                  className={`gm-num${on ? ' on' : ''}`} pathOptions={{ fillOpacity: 1, weight: on ? 2.5 : 1.5 }} eventHandlers={{ click: () => pick(p.id) }}>
                  <Tooltip permanent direction="center" offset={[0, 0]} className={`gm-n${on ? ' on' : ''}`}>{p.num}</Tooltip>
                </CircleMarker>
              ) : (
                // Leaflet reads the class only when it draws the dot, so a dot whose
                // class changes is drawn anew. In pathOptions it came too late, and
                // every dot was Leaflet's own blue, its tap ring a pale blue halo.
                <CircleMarker key={`${p.id}-${on}`} center={[p.lat, p.lng]} radius={on ? 8 : quiet ? 7 : 5}
                  className={`gm-dot${on ? ' on' : ''}`} pathOptions={{ fillOpacity: 1, weight: on ? 3 : 1.5 }} eventHandlers={{ click: () => pick(p.id) }} />
              )}
            </Fragment>
          );
        })}
      </MapContainer>
      <style>{`
        .gm { position: relative; z-index: 0; isolation: isolate; width: 100%; height: var(--geo-map-h, 440px); border: 1px solid var(--border2); border-radius: var(--radius-lg, 14px); overflow: hidden; background: #e6e6e6; }
        .gm .leaflet-container { background: #e6e6e6; font-family: var(--font-ui); }
        .gm.plain, .gm.plain .leaflet-container { background: #d6e4f0; }
        .gm.marking .leaflet-container { cursor: crosshair; }
        /* Leaflet's plus-lighter tile blend draws pale seams at a fractional zoom. */
        .gm .leaflet-container img.leaflet-tile { mix-blend-mode: normal; }
        .gm-hit { fill: transparent; stroke: none; cursor: pointer; }
        .gm-dot { fill: var(--t, var(--accent)); stroke: rgba(255, 255, 255, 0.85); cursor: pointer; }
        .gm-dot.on { fill: #fff; stroke: var(--t, var(--accent)); }
        .gm-border { stroke: #3a3a3a; stroke-opacity: 0.55; }
        .gm-num { fill: #fff; stroke: #2a2a2a; cursor: pointer; }
        .gm-num.on { fill: var(--t, var(--accent)); stroke: #fff; }
        .gm-n { background: transparent !important; border: none !important; box-shadow: none !important; padding: 0 !important; color: #2a2a2a !important; font: 800 10px var(--font-ui); user-select: none; pointer-events: none; }
        .gm-n.on { color: #fff !important; font-size: 11px; }
        .gm-n::before, .gm-mark-n::before { display: none !important; }
        .gm-mark { stroke: #fff; }
        .gm-mark.open { fill: var(--t, var(--accent)); }
        .gm-mark.right { fill: var(--success-text); }
        .gm-mark.close { fill: var(--warning-text); }
        .gm-mark.off { fill: var(--danger-text); }
        .gm-line { stroke: var(--text2); }
        .gm-line.right { stroke: var(--success-text); }
        .gm-line.close { stroke: var(--warning-text); }
        .gm-line.off { stroke: var(--danger-text); }
        .gm-mark-n { background: var(--ds-card) !important; border: 1px solid var(--border2) !important; box-shadow: none !important; padding: 0 5px !important; border-radius: 9px !important; color: var(--text) !important; font: 800 10px var(--font-ui); }
        .gm-tip { display: flex; flex-direction: column; gap: 1px; padding: 6px 10px !important; background: var(--ds-card, #fff) !important; border: 1px solid var(--border2) !important; border-radius: 8px !important; box-shadow: var(--elev-2) !important; color: var(--text) !important; font-family: var(--font-ui); font-size: 12px; }
        .gm-tip span { color: var(--text3); font-size: 11px; }
        .gm-tip::before { border-top-color: var(--border2) !important; }
      `}</style>
    </div>
  );
}
