import { lazy } from 'react';
import type { EntityPreviewRegistry } from './types';

export const entityPreviewRegistry: EntityPreviewRegistry = {
  estate: {
    Panel: lazy(() =>
      import('./entities/estate/EstatePreviewPanel').then(
        ({ EstatePreviewPanel }) => ({ default: EstatePreviewPanel }),
      ),
    ),
    getHref: (id) => `/property-rental/estates?estate_edit=${id}`,
  },
  building: {
    Panel: lazy(() =>
      import('./entities/building/BuildingPreviewPanel').then(
        ({ BuildingPreviewPanel }) => ({ default: BuildingPreviewPanel }),
      ),
    ),
    getHref: (id) =>
      `/property-rental/estates?view=buildings&building_edit=${id}`,
  },
  house: {
    Panel: lazy(() =>
      import('./entities/house/HousePreviewPanel').then(
        ({ HousePreviewPanel }) => ({ default: HousePreviewPanel }),
      ),
    ),
    getHref: (id) => `/property-rental/houses/${id}`,
  },
};
