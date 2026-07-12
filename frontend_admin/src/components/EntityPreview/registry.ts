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
  contact: {
    Panel: lazy(() =>
      import('./entities/contact/ContactPreviewPanel').then(
        ({ ContactPreviewPanel }) => ({ default: ContactPreviewPanel }),
      ),
    ),
    getHref: (id) => `/property-rental/contacts?edit=${id}`,
  },
  lease: {
    Panel: lazy(() =>
      import('./entities/lease/LeasePreviewPanel').then(
        ({ LeasePreviewPanel }) => ({ default: LeasePreviewPanel }),
      ),
    ),
    getHref: (id) => `/property-rental/leases?edit=${id}`,
  },
};
