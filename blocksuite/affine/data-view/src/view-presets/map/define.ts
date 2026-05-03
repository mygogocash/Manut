import type { FilterGroup } from '../../core/filter/types.js';
import type { Sort } from '../../core/sort/types.js';
import { type BasicViewDataType, viewType } from '../../core/view/data-view.js';
import { MapSingleView } from './map-view-manager.js';

export const mapViewType = viewType('map');

export type MapViewColumn = {
  id: string;
  hide?: boolean;
};

type DataType = {
  /** Property ids shown in the view. */
  columns: MapViewColumn[];

  filter: FilterGroup;
  sort?: Sort;

  header: {
    titleColumn?: string;
    iconColumn?: string;
  };

  /** γ-MAP-3: property id containing lat,lng or address string for each row. */
  geoColumnId?: string;

  /** OSM or compatible tile URL template (e.g. https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png). */
  mapStyle?: string;

  /** Initial zoom level 1-18. */
  zoom?: number;

  /** [lat, lng] of the initial map center. */
  center?: [number, number];
};

export type MapViewData = BasicViewDataType<typeof mapViewType.type, DataType>;

export const mapViewModel = mapViewType.createModel<MapViewData>({
  defaultName: 'Map View',
  dataViewManager: MapSingleView,
  defaultData: viewManager => {
    const allProps = viewManager.dataSource.properties$.value;

    const titleColumn = allProps.find(
      id => viewManager.dataSource.propertyTypeGet(id) === 'title'
    );

    return {
      columns: allProps.map(id => ({ id })),
      filter: { type: 'group', op: 'and', conditions: [] },
      header: {
        titleColumn,
        iconColumn: 'type',
      },
      zoom: 10,
      center: [0, 0],
    };
  },
});
