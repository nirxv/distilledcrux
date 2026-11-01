/**
 * Map tiles for the Geography map practice.
 *
 * CARTO stopped serving its raster basemaps to unregistered callers: without a
 * key every tile comes back stamped "API KEY REQUIRED" as a normal image, so a
 * bad key looks exactly like none. CARTO is used only when a key is set, and
 * otherwise Esri's keyless light grey canvas.
 *
 * Both are label-free on purpose: this is practice at finding places, and a
 * basemap that prints "Chilika Lake" next to the dot gives the answer away.
 * Esri's tile order is {z}/{y}/{x}, not the usual {z}/{x}/{y}.
 */
export type Basemap = { url: string; attribution: string; maxNativeZoom: number };

const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY;

/** The political map: no labels, since state lines are drawn on top. */
export const politicalBasemap: Basemap = CARTO_KEY
  ? { url: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png?api_key=${CARTO_KEY}`, attribution: '&copy; OpenStreetMap &copy; CARTO', maxNativeZoom: 20 }
  : { url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri', maxNativeZoom: 16 };

/**
 * The physical map: relief, rivers and water, with no place names. Esri
 * publishes it only to zoom 8; past that Leaflet stretches the zoom-8 tiles
 * instead of fetching blank "data not available" ones.
 */
export const physicalBasemap: Basemap = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}',
  attribution: '&copy; Esri, U.S. National Park Service',
  maxNativeZoom: 8,
};
