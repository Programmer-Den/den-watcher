import {
  FIT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  MapViewport,
  TILE,
  fitView,
  panBy,
  project,
  scaleBar,
  spotAt,
  viewTiles,
  zoomAround,
} from './map-view';

const WIDTH = 640;
const HEIGHT = 360;

/** Two places in Hamburg about 2.2 km apart, north of each other. */
const south = { lat: 53.55, lon: 10 };
const north = { lat: 53.57, lon: 10 };

describe('map view', () => {
  it('puts the places on the map of the world, north up', () => {
    expect(project(0, 0)).toEqual({ x: TILE / 2, y: TILE / 2 });
    expect(project(north.lat, north.lon).y).toBeLessThan(project(south.lat, south.lon).y);
  });

  it('opens on the closest whole zoom that holds all places, centered on them', () => {
    const view = fitView([south, north], WIDTH, HEIGHT, 32);
    expect(Number.isInteger(view.zoom)).toBe(true);
    const a = spotAt(view, WIDTH, HEIGHT, south);
    const b = spotAt(view, WIDTH, HEIGHT, north);
    for (const p of [a, b]) {
      expect(p.y).toBeGreaterThanOrEqual(32);
      expect(p.y).toBeLessThanOrEqual(HEIGHT - 32);
    }
    expect(a.x).toBe(WIDTH / 2);
    // One level closer would not hold them.
    expect(Math.abs(a.y - b.y) * 2).toBeGreaterThan(HEIGHT - 64);
    // A single place opens at a street, not as close as the map goes.
    expect(fitView([south], WIDTH, HEIGHT, 32).zoom).toBe(FIT_ZOOM);
  });

  it('keeps the spot under the pointer where it is while zooming', () => {
    const view = fitView([south, north], WIDTH, HEIGHT, 32);
    const at = spotAt(view, WIDTH, HEIGHT, north);
    const closer = zoomAround(view, 1.5, at, WIDTH, HEIGHT);
    expect(closer.zoom).toBe(view.zoom + 1.5);
    const after = spotAt(closer, WIDTH, HEIGHT, north);
    expect(after.x).toBeCloseTo(at.x, 0);
    expect(after.y).toBeCloseTo(at.y, 0);
    expect(zoomAround(view, 50, at, WIDTH, HEIGHT).zoom).toBe(MAX_ZOOM);
    expect(zoomAround(view, -50, at, WIDTH, HEIGHT).zoom).toBe(MIN_ZOOM);
  });

  it('moves the map with the drag', () => {
    const view = fitView([south, north], WIDTH, HEIGHT, 32);
    const before = spotAt(view, WIDTH, HEIGHT, south);
    const after = spotAt(panBy(view, 30, -20), WIDTH, HEIGHT, south);
    expect(after.x).toBeCloseTo(before.x + 30, 0);
    expect(after.y).toBeCloseTo(before.y - 20, 0);
  });

  it('covers the view with tiles of the closest level, scaled between levels', () => {
    const view = fitView([south, north], WIDTH, HEIGHT, 32);
    const tiles = viewTiles(view, WIDTH, HEIGHT);
    expect(tiles[0].href).toMatch(
      new RegExp(`^https://tile\\.openstreetmap\\.org/${view.zoom}/\\d+/\\d+\\.png$`),
    );
    expect(tiles.every((t) => t.size === TILE)).toBe(true);
    expect(Math.min(...tiles.map((t) => t.x))).toBeLessThanOrEqual(0);
    expect(Math.max(...tiles.map((t) => t.x + t.size))).toBeGreaterThanOrEqual(WIDTH);
    expect(Math.min(...tiles.map((t) => t.y))).toBeLessThanOrEqual(0);
    expect(Math.max(...tiles.map((t) => t.y + t.size))).toBeGreaterThanOrEqual(HEIGHT);
    const between = viewTiles({ ...view, zoom: view.zoom + 0.4 }, WIDTH, HEIGHT);
    expect(between[0].href).toContain(`/${view.zoom}/`);
    expect(between[0].size).toBeGreaterThan(TILE * 1.3);
  });

  it('picks a round length for the scale bar that fits', () => {
    const bar = scaleBar(fitView([south, north], WIDTH, HEIGHT, 32), 96);
    expect([100, 200, 500, 1000]).toContain(bar.meters);
    expect(bar.length).toBeLessThanOrEqual(96);
    expect(bar.length).toBeGreaterThan(30);
  });
});

describe('MapViewport', () => {
  it('opens on the whole, keeps the zoom when the places are read again and resets on demand', () => {
    const map = new MapViewport(WIDTH, HEIGHT);
    expect(map.view()).toBeNull();
    map.show([south, north]);
    const whole = map.view()!;
    expect(map.zoomed()).toBe(false);
    map.zoom(1);
    expect(map.view()!.zoom).toBe(whole.zoom + 1);
    expect(map.zoomed()).toBe(true);
    map.show([south, north, { lat: 53.56, lon: 10.01 }]);
    expect(map.view()!.zoom).toBe(whole.zoom + 1);
    map.showWhole();
    expect(map.zoomed()).toBe(false);
    map.zoom(1);
    map.show([south], true);
    expect(map.view()!.zoom).toBe(FIT_ZOOM);
    map.show([]);
    expect(map.view()).toBeNull();
  });

  it('moves a place into the middle without zooming out', () => {
    const map = new MapViewport(WIDTH, HEIGHT);
    map.show([south, north]);
    const zoom = map.view()!.zoom;
    map.centerOn(north);
    expect(map.at(north)).toEqual({ x: WIDTH / 2, y: HEIGHT / 2 });
    expect(map.view()!.zoom).toBe(zoom);
    map.centerOn(south, zoom + 2);
    expect(map.view()!.zoom).toBe(zoom + 2);
    expect(map.canZoomIn()).toBe(true);
  });
});
