import type { InsertToPosition } from '@blocksuite/affine-shared/utils';
import { css } from '@emotion/css';
import { effect, signal } from '@preact/signals-core';
import { type TemplateResult } from 'lit';
import { html } from 'lit/static-html.js';

import {
  createUniComponentFromWebComponent,
  renderUniLit,
} from '../../../core/index.js';
import {
  DataViewUIBase,
  DataViewUILogicBase,
} from '../../../core/view/data-view-base.js';
import type { MapSingleView, RowPin } from '../map-view-manager.js';
import type { MapViewSelectionWithType } from '../selection.js';

// ─── Leaflet dynamic loader ────────────────────────────────────────────────
// γ-MAP-2: Integrate map library via CDN dynamic loading (no bundler dependency)

/** Cached promise so we load Leaflet at most once. */
let leafletLoadPromise: Promise<LeafletStatic> | null = null;

interface LeafletStatic {
  map(el: HTMLElement, opts?: Record<string, unknown>): LeafletMap;
  tileLayer(url: string, opts?: Record<string, unknown>): LeafletTileLayer;
  marker(latLng: [number, number], opts?: Record<string, unknown>): LeafletMarker;
  markerClusterGroup?: () => LeafletClusterGroup;
  layerGroup(): LeafletLayerGroup;
}

interface LeafletMap {
  setView(latLng: [number, number], zoom: number): LeafletMap;
  addLayer(layer: LeafletLayer): LeafletMap;
  removeLayer(layer: LeafletLayer): LeafletMap;
  fitBounds(bounds: [[number, number], [number, number]], opts?: Record<string, unknown>): LeafletMap;
  getZoom(): number;
  getCenter(): { lat: number; lng: number };
  on(event: string, handler: (...args: unknown[]) => void): LeafletMap;
  off(event: string, handler: (...args: unknown[]) => void): LeafletMap;
  remove(): void;
  invalidateSize(): void;
}

interface LeafletLayer {
  addTo(map: LeafletMap): LeafletLayer;
  remove(): void;
}

interface LeafletTileLayer extends LeafletLayer {}

interface LeafletMarker extends LeafletLayer {
  bindPopup(content: string): LeafletMarker;
  on(event: string, handler: (...args: unknown[]) => void): LeafletMarker;
}

interface LeafletLayerGroup extends LeafletLayer {
  clearLayers(): LeafletLayerGroup;
  addLayer(layer: LeafletLayer): LeafletLayerGroup;
}

interface LeafletClusterGroup extends LeafletLayerGroup {}

async function ensureLeaflet(): Promise<LeafletStatic> {
  if ((window as any).L) return (window as any).L as LeafletStatic;
  if (leafletLoadPromise) return leafletLoadPromise;

  leafletLoadPromise = new Promise<LeafletStatic>((resolve, reject) => {
    // Add CSS
    if (!document.querySelector('link[data-leaflet-css]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.dataset.leafletCss = '1';
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve((window as any).L as LeafletStatic);
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return leafletLoadPromise;
}

/** γ-MAP-5: Dynamically load leaflet.markercluster when there are many pins. */
async function ensureMarkerCluster(L: LeafletStatic): Promise<void> {
  if (L.markerClusterGroup) return;

  if (!document.querySelector('link[data-markercluster-css]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href =
      'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';
    link.dataset.markerclusterCss = '1';
    document.head.appendChild(link);
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src =
      'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ─── γ-MAP-4: Address geocoding via Nominatim ─────────────────────────────
// Respects Nominatim usage policy: max 1 req/sec, results cached for the session.

const geocodeCache = new Map<string, [number, number] | null>();
let lastGeocodeTime = 0;
const GEOCODE_DELAY_MS = 1100; // >1 s to respect Nominatim policy

async function geocodeAddress(
  address: string
): Promise<[number, number] | null> {
  if (geocodeCache.has(address)) return geocodeCache.get(address)!;

  // Rate-limit to 1 req/sec
  const now = Date.now();
  const wait = GEOCODE_DELAY_MS - (now - lastGeocodeTime);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastGeocodeTime = Date.now();

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const resp = await fetch(url, {
      headers: { 'Accept-Language': 'en' },
    });
    if (!resp.ok) {
      geocodeCache.set(address, null);
      return null;
    }
    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) {
      geocodeCache.set(address, null);
      return null;
    }
    const { lat, lon } = data[0];
    const coords: [number, number] = [parseFloat(lat), parseFloat(lon)];
    geocodeCache.set(address, coords);
    return coords;
  } catch {
    geocodeCache.set(address, null);
    return null;
  }
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const mapViewStyle = css`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 400px;
  font-size: 14px;
`;

const mapHeaderStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  margin-bottom: 4px;
  position: relative;
`;

const mapHeaderTitleStyle = css`
  font-weight: 600;
  font-size: 16px;
`;

const settingsButtonStyle = css`
  appearance: none;
  border: 1px solid var(--affine-border-color, #e3e3e3);
  background: transparent;
  color: inherit;
  border-radius: 6px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  &:hover {
    background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
  }
`;

const settingsDropdownStyle = css`
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  background: var(--affine-background-overlay-panel-color, #fff);
  border: 1px solid var(--affine-border-color, #e3e3e3);
  border-radius: 8px;
  padding: 12px;
  z-index: 1000;
  min-width: 240px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);

  label {
    display: block;
    font-size: 12px;
    color: var(--affine-text-secondary-color, #888);
    margin-bottom: 4px;
  }

  select {
    width: 100%;
    padding: 4px 8px;
    border: 1px solid var(--affine-border-color, #e3e3e3);
    border-radius: 4px;
    background: transparent;
    color: inherit;
    font-size: 13px;
  }
`;

const settingsWrapperStyle = css`
  position: relative;
`;

const mapContainerStyle = css`
  flex: 1;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--affine-border-color, #e3e3e3);
  min-height: 350px;
`;

const noGeoColumnHintStyle = css`
  padding: 24px;
  border: 1px dashed var(--affine-border-color, #e3e3e3);
  color: var(--affine-text-secondary-color, #888);
  border-radius: 8px;
  text-align: center;
  margin: 8px 0;
`;

const geocodingStatusStyle = css`
  padding: 4px 8px;
  font-size: 11px;
  color: var(--affine-text-secondary-color, #888);
  text-align: right;
`;

// ─── UI logic ────────────────────────────────────────────────────────────────

export class MapViewUILogic extends DataViewUILogicBase<
  MapSingleView,
  MapViewSelectionWithType
> {
  ui$ = signal<MapViewUI | undefined>();

  settingsOpen$ = signal(false);

  toggleSettings = () => {
    this.settingsOpen$.value = !this.settingsOpen$.value;
  };

  closeSettings = () => {
    this.settingsOpen$.value = false;
  };

  clearSelection = () => {
    this.setSelection(undefined);
  };

  addRow = (_position: InsertToPosition) => {
    if (this.view.readonly$.value) return undefined;
    const rowId = this.view.addRowWithDefaults('end');
    if (rowId) {
      this.root.openDetailPanel({ view: this.view, rowId });
    }
    return rowId;
  };

  focusFirstCell = () => {
    // No keyboard-focused cell concept in map view.
  };

  showIndicator = (_evt: MouseEvent) => false;

  hideIndicator = () => {};

  moveTo = (_id: string, _evt: MouseEvent) => {};

  renderer = createUniComponentFromWebComponent(MapViewUI);
}

// ─── Lit element ─────────────────────────────────────────────────────────────

export class MapViewUI extends DataViewUIBase<MapViewUILogic> {
  /** The Leaflet map instance. Created once, destroyed on disconnect. */
  private leafletMap: LeafletMap | null = null;

  /** Layer group (or cluster group) holding all row markers. */
  private markerGroup: LeafletLayerGroup | null = null;

  /** Tracks the marker for each rowId so we can remove stale ones. */
  private markerMap = new Map<string, LeafletMarker>();

  /** Refs to disposers returned by effect(). */
  private effectDisposers: Array<() => void> = [];

  /** How many rows are currently pending geocoding. */
  private geocodingPending$ = signal(0);

  /** Container div for Leaflet. */
  private mapContainer: HTMLDivElement | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.logic.ui$.value = this;
    this.classList.add(mapViewStyle);
    // Map initialisation is deferred to firstUpdated / updateComplete
    this.updateComplete.then(() => this.initMap());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.teardownMap();
  }

  // ─── Map lifecycle ────────────────────────────────────────────────────────

  private async initMap(): Promise<void> {
    // γ-MAP-2: Load Leaflet
    let L: LeafletStatic;
    try {
      L = await ensureLeaflet();
    } catch {
      // If CDN is unavailable (e.g. offline), show nothing — the hint text covers it.
      return;
    }

    // Find container rendered by Lit's template (identified via data attribute)
    const container =
      this.mapContainer ??
      (this.renderRoot?.querySelector('[data-map-container]') as HTMLDivElement | null);
    if (!container || !this.isConnected) return;
    this.mapContainer = container;

    const center = this.logic.view.mapCenter$.value;
    const zoom = this.logic.view.mapZoom$.value;

    // γ-MAP-2: Create Leaflet map
    const map = L.map(container, { preferCanvas: true }).setView(center, zoom);

    const tileUrl =
      this.logic.view.view?.mapStyle ??
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    L.tileLayer(tileUrl, {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);

    this.leafletMap = map;

    // γ-MAP-3: Watch pins and update markers reactively
    const disposer = effect(() => {
      const pins = this.logic.view.rowPins$.value;
      void this.updateMarkers(L, pins);
    });
    this.effectDisposers.push(disposer);

    // γ-MAP-4: Watch rows with addresses and geocode them
    const addressDisposer = effect(() => {
      const entries = this.logic.view.rowPinsWithAddresses$.value;
      void this.geocodeAndUpdateAddressPins(L, entries);
    });
    this.effectDisposers.push(addressDisposer);

    // Persist zoom/center changes back to view data
    map.on('zoomend moveend', () => {
      const z = map.getZoom();
      const c = map.getCenter();
      this.logic.view.setMapZoom(z);
      this.logic.view.setMapCenter([c.lat, c.lng]);
    });
  }

  private teardownMap(): void {
    for (const dispose of this.effectDisposers) dispose();
    this.effectDisposers = [];
    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = null;
    }
    this.markerMap.clear();
    this.markerGroup = null;
  }

  // ─── Marker management ───────────────────────────────────────────────────

  /** γ-MAP-3: Plot coordinate-based pins. */
  private async updateMarkers(L: LeafletStatic, pins: RowPin[]): Promise<void> {
    const map = this.leafletMap;
    if (!map) return;

    const useClustering = pins.length > 20;

    if (useClustering && !this.markerGroup?.constructor?.name?.includes('Cluster')) {
      // γ-MAP-5: Load marker cluster plugin
      try {
        await ensureMarkerCluster(L);
        if (this.markerGroup) {
          map.removeLayer(this.markerGroup);
        }
        this.markerGroup = L.markerClusterGroup
          ? L.markerClusterGroup()
          : L.layerGroup();
      } catch {
        if (!this.markerGroup) {
          this.markerGroup = L.layerGroup();
        }
      }
    } else if (!this.markerGroup) {
      this.markerGroup = L.layerGroup();
    }

    // Clear existing markers
    this.markerGroup.clearLayers();
    this.markerMap.clear();

    for (const pin of pins) {
      const marker = L.marker([pin.lat, pin.lng]);
      marker.bindPopup(`<strong>${escapeHtml(pin.title)}</strong>`);
      marker.on('click', () => {
        this.root.openDetailPanel({ view: this.logic.view, rowId: pin.rowId });
      });
      this.markerGroup.addLayer(marker);
      this.markerMap.set(pin.rowId, marker);
    }

    map.addLayer(this.markerGroup);

    // Auto-fit bounds if there are any pins
    if (pins.length > 0) {
      const latMin = Math.min(...pins.map(p => p.lat));
      const latMax = Math.max(...pins.map(p => p.lat));
      const lngMin = Math.min(...pins.map(p => p.lng));
      const lngMax = Math.max(...pins.map(p => p.lng));
      try {
        map.fitBounds(
          [
            [latMin, lngMin],
            [latMax, lngMax],
          ],
          { maxZoom: 14, padding: [40, 40] as unknown as [number, number] }
        );
      } catch {
        // fitBounds can throw if bounds are degenerate (single point); ignore
      }
    }

    this.requestUpdate();
  }

  /** γ-MAP-4: Geocode address entries and add markers for them. */
  private async geocodeAndUpdateAddressPins(
    L: LeafletStatic,
    entries: Array<RowPin | { rowId: string; address: string; title: string }>
  ): Promise<void> {
    const addressEntries = entries.filter(
      (e): e is { rowId: string; address: string; title: string } =>
        'address' in e
    );

    if (addressEntries.length === 0) return;

    this.geocodingPending$.value = addressEntries.length;
    this.requestUpdate();

    for (const entry of addressEntries) {
      const coords = await geocodeAddress(entry.address);
      this.geocodingPending$.value = Math.max(
        0,
        this.geocodingPending$.value - 1
      );

      if (!coords || !this.leafletMap || !this.isConnected) continue;

      // Add a geocoded marker directly (outside the main cluster group for simplicity)
      const marker = L.marker(coords);
      marker.bindPopup(
        `<strong>${escapeHtml(entry.title)}</strong><br/><small>${escapeHtml(entry.address)}</small>`
      );
      marker.on('click', () => {
        this.root.openDetailPanel({
          view: this.logic.view,
          rowId: entry.rowId,
        });
      });
      if (this.markerGroup) {
        this.markerGroup.addLayer(marker);
        this.markerMap.set(entry.rowId, marker);
      } else {
        marker.addTo(this.leafletMap);
      }
    }

    this.requestUpdate();
  }

  // ─── γ-MAP-6: View settings header ───────────────────────────────────────

  private renderSettingsDropdown(): TemplateResult {
    const allProps = this.logic.view.propertiesRaw$.value;
    const currentGeoId = this.logic.view.geoColumnId$.value;

    // Properties that could hold geo data: text, url, rich-text, or any
    const eligibleProps = allProps.filter(p => {
      const type = p.type$.value;
      return (
        type === 'text' ||
        type === 'url' ||
        type === 'rich-text' ||
        type === 'title' ||
        // include unknown types too
        true
      );
    });

    return html`
      <div class=${settingsDropdownStyle}>
        <label>Geo column:</label>
        <select
          .value=${currentGeoId ?? ''}
          @change=${(e: Event) => {
            const sel = e.target as HTMLSelectElement;
            const id = sel.value || undefined;
            this.logic.view.setGeoColumnId(id);
          }}
        >
          <option value="">— none —</option>
          ${eligibleProps.map(
            p => html`
              <option value=${p.id} ?selected=${p.id === currentGeoId}>
                ${p.name$.value || p.id}
              </option>
            `
          )}
        </select>
      </div>
    `;
  }

  private renderHeader(): TemplateResult {
    const settingsOpen = this.logic.settingsOpen$.value;
    const pendingGeocode = this.geocodingPending$.value;

    return html`
      <div class=${mapHeaderStyle}>
        <div class=${mapHeaderTitleStyle}>Map</div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${pendingGeocode > 0
            ? html`<span class=${geocodingStatusStyle}
                >Geocoding ${pendingGeocode} address${pendingGeocode > 1 ? 'es' : ''}…</span
              >`
            : ''}
          <div class=${settingsWrapperStyle}>
            <button
              class=${settingsButtonStyle}
              title="Map settings"
              @click=${(e: MouseEvent) => {
                e.stopPropagation();
                this.logic.toggleSettings();
              }}
            >
              ⚙
            </button>
            ${settingsOpen ? this.renderSettingsDropdown() : ''}
          </div>
        </div>
      </div>
    `;
  }

  override render(): TemplateResult {
    const geoColId = this.logic.view.geoColumnId$.value;

    return html`
      ${renderUniLit(this.logic.root.config.headerWidget, {
        dataViewLogic: this.logic,
      })}
      ${this.renderHeader()}
      ${!geoColId
        ? html`
            <div class=${noGeoColumnHintStyle}>
              This map view has no geo column configured.<br />
              Use the ⚙ settings button above to pick a property containing
              <strong>"lat,lng"</strong> coordinates or an address string.
            </div>
          `
        : html`
            <div class=${mapContainerStyle} data-map-container></div>
          `}
    `;
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-data-view-map': MapViewUI;
  }
}
