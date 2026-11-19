import { computed, signal } from '@angular/core';

/** The size of one tile of the map, in pixels at its zoom, as OpenStreetMap draws them. */
export const TILE = 256;

/** The zoom levels the map can show: from a country to a house, as far as OpenStreetMap draws. */
export const MIN_ZOOM = 3;
export const MAX_ZOOM = 19;

/** The closest zoom a map opens at: a street, so a single point still shows where it is. */
export const FIT_ZOOM = 17;

/** How much one step of the zoom buttons or a double click zooms, in zoom levels. */
export const ZOOM_STEP = 1;

/** Where OpenStreetMap serves its tiles: the browser loads them from there, not the hub. */
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** A place on the earth, in degrees. */
export interface LatLon {
  lat: number;
  lon: number;
}

/** A spot on the map, in its units. */
export interface Spot {
  x: number;
  y: number;
}

/**
 * What a map shows: its zoom, which may lie between two levels, and its middle on the whole map of
 * the world at zoom 0, which is TILE units wide.
 */
export interface View {
  zoom: number;
  x: number;
  y: number;
}

/** One tile of the map: where it is drawn and how large, in map units, and where it is loaded from. */
export interface MapTile {
  href: string;
  x: number;
  y: number;
  size: number;
}

/** Where a place is on the whole map of the world at zoom 0 (Web Mercator). */
export function project(lat: number, lon: number): Spot {
  const sin = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return {
    x: ((lon + 180) / 360) * TILE,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * TILE,
  };
}

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/**
 * The view that shows all the places, centered on them, with `padding` map units around: the
 * closest whole zoom level that holds them, at most FIT_ZOOM.
 */
export function fitView(places: LatLon[], width: number, height: number, padding: number): View {
  const spots = places.map((p) => project(p.lat, p.lon));
  const west = Math.min(...spots.map((s) => s.x));
  const east = Math.max(...spots.map((s) => s.x));
  const north = Math.min(...spots.map((s) => s.y));
  const south = Math.max(...spots.map((s) => s.y));
  let zoom = MIN_ZOOM;
  for (let z = FIT_ZOOM; z >= MIN_ZOOM; z--) {
    const scale = 2 ** z;
    if (
      (east - west) * scale <= width - 2 * padding &&
      (south - north) * scale <= height - 2 * padding
    ) {
      zoom = z;
      break;
    }
  }
  return { zoom, x: (west + east) / 2, y: (north + south) / 2 };
}

/** The view zoomed by `levels` around a spot of the map, which stays where it is. */
export function zoomAround(
  view: View,
  levels: number,
  at: Spot,
  width: number,
  height: number,
): View {
  const zoom = clampZoom(view.zoom + levels);
  const before = 2 ** view.zoom;
  const after = 2 ** zoom;
  // The world spot under `at` stays under it.
  const dx = (at.x - width / 2) / before;
  const dy = (at.y - height / 2) / before;
  return {
    zoom,
    x: view.x + dx - (dx * before) / after,
    y: view.y + dy - (dy * before) / after,
  };
}

/** The view moved by a drag of `dx`, `dy` map units: the map follows the pointer. */
export function panBy(view: View, dx: number, dy: number): View {
  const scale = 2 ** view.zoom;
  return { ...view, x: view.x - dx / scale, y: view.y - dy / scale };
}

/** Where a place is drawn in a view of `width` by `height` map units. */
export function spotAt(view: View, width: number, height: number, place: LatLon): Spot {
  const p = project(place.lat, place.lon);
  const scale = 2 ** view.zoom;
  return {
    x: round((p.x - view.x) * scale + width / 2),
    y: round((p.y - view.y) * scale + height / 2),
  };
}

/**
 * The OpenStreetMap tiles that cover a view: from the whole zoom level closest to it, drawn larger
 * or smaller for a zoom between two levels.
 */
export function viewTiles(view: View, width: number, height: number): MapTile[] {
  const level = Math.min(MAX_ZOOM, Math.max(0, Math.round(view.zoom)));
  const size = TILE * 2 ** (view.zoom - level);
  const count = 2 ** level;
  // The view's top left corner, in tiles of `level`.
  const left = (view.x * 2 ** view.zoom - width / 2) / size;
  const top = (view.y * 2 ** view.zoom - height / 2) / size;
  const tiles: MapTile[] = [];
  for (let ty = Math.floor(top); ty < top + height / size; ty++) {
    if (ty < 0 || ty >= count) {
      continue;
    }
    for (let tx = Math.floor(left); tx < left + width / size; tx++) {
      const wrapped = ((tx % count) + count) % count;
      tiles.push({
        href: TILE_URL.replace('{z}', String(level))
          .replace('{x}', String(wrapped))
          .replace('{y}', String(ty)),
        x: round((tx - left) * size),
        y: round((ty - top) * size),
        // A hair larger, so no seam shows between tiles drawn at a zoom between two levels.
        size: level === view.zoom ? TILE : round(size) + 0.5,
      });
    }
  }
  return tiles;
}

/** The lengths the scale bar picks from, in meters. */
const SCALE_METERS = [
  5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000, 200_000, 500_000,
  1_000_000,
];

/** The circumference of the earth at the equator, in meters, which the map is TILE units wide at zoom 0. */
const EARTH_CIRCUMFERENCE = 40_075_016.686;

/**
 * The scale bar for a view: the longest round length that fits in `most` map units, at the view's
 * middle, and how long it is drawn.
 */
export function scaleBar(view: View, most: number): { meters: number; length: number } {
  const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * view.y) / TILE)));
  const metersPerUnit = (EARTH_CIRCUMFERENCE * Math.cos(lat)) / (TILE * 2 ** view.zoom);
  const meters = SCALE_METERS.filter((m) => m / metersPerUnit <= most).at(-1) ?? SCALE_METERS[0];
  return { meters, length: round(meters / metersPerUnit) };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * A map the user can zoom and move: its size in map units, which it is drawn at and scaled from to
 * fit the page, and what it shows. It opens on all its places and keeps the user's zoom while they
 * are read again, until it is shown whole again or what it shows changes.
 */
export class MapViewport {
  /** The view that shows all the places, which the fit button goes back to. */
  private readonly whole = signal<View | null>(null);
  private readonly moved = signal<View | null>(null);

  /** What the map shows now, or null while it has no places. */
  readonly view = computed(() => this.moved() ?? this.whole());

  /** Whether the user zoomed or moved the map away from the whole. */
  readonly zoomed = computed(() => this.moved() !== null);

  /** The tiles that cover the view. */
  readonly tiles = computed(() => {
    const view = this.view();
    return view ? viewTiles(view, this.width, this.height) : [];
  });

  /** Whether to tell how to zoom: shown a moment after a scroll without Ctrl over the map. */
  readonly hint = signal(false);

  /** Whether the map can be zoomed in or out further. */
  readonly canZoomIn = computed(() => (this.view()?.zoom ?? MAX_ZOOM) < MAX_ZOOM);
  readonly canZoomOut = computed(() => (this.view()?.zoom ?? MIN_ZOOM) > MIN_ZOOM);

  constructor(
    readonly width: number,
    readonly height: number,
    private readonly padding = 32,
  ) {}

  /** Where a place is drawn, in map units; only valid while the map has a view. */
  at(place: LatLon): Spot {
    const view = this.view();
    return view ? spotAt(view, this.width, this.height, place) : { x: 0, y: 0 };
  }

  /**
   * Shows all the places, or none. The user's zoom stays unless `again` is set, as when the map
   * shows something else, such as another range.
   */
  show(places: LatLon[], again = false): void {
    this.whole.set(
      places.length > 0 ? fitView(places, this.width, this.height, this.padding) : null,
    );
    if (again || places.length === 0) {
      this.moved.set(null);
    }
  }

  /** Shows the whole again. */
  showWhole(): void {
    this.moved.set(null);
  }

  /** Zooms in on some of the places, all of them on the map, as the user would. */
  focus(places: LatLon[]): void {
    if (places.length > 0) {
      this.moved.set(fitView(places, this.width, this.height, this.padding));
    }
  }

  /** Zooms by `levels` around a spot, by default the middle. */
  zoom(levels: number, at: Spot = { x: this.width / 2, y: this.height / 2 }): void {
    const view = this.view();
    if (view) {
      this.moved.set(zoomAround(view, levels, at, this.width, this.height));
    }
  }

  /** Moves the map by a drag of `dx`, `dy` map units. */
  pan(dx: number, dy: number): void {
    const view = this.view();
    if (view && (dx !== 0 || dy !== 0)) {
      this.moved.set(panBy(view, dx, dy));
    }
  }

  /** Moves the map so a place is in the middle, at least at `zoom`. */
  centerOn(place: LatLon, zoom = 0): void {
    const view = this.view();
    if (view) {
      const p = project(place.lat, place.lon);
      this.moved.set({ zoom: clampZoom(Math.max(view.zoom, zoom)), x: p.x, y: p.y });
    }
  }
}
