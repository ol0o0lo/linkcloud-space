import { lazy } from 'react';
import type { EntityPreviewRegistry } from './types';

export const entityPreviewRegistry: EntityPreviewRegistry = {
  estate: {
    Panel: lazy(() =>
      import('./entities/estate/EstatePreviewPanel').then(
        ({ EstatePreviewPanel }) => ({ default: EstatePreviewPanel }),
      ),
    ),
    getHref: (id) => `/rental/properties/estates/${id}`,
    popoverMedia: true,
    popoverWidth: 460,
  },
  building: {
    Panel: lazy(() =>
      import('./entities/building/BuildingPreviewPanel').then(
        ({ BuildingPreviewPanel }) => ({ default: BuildingPreviewPanel }),
      ),
    ),
    getHref: (id) => `/rental/properties/buildings/${id}`,
    popoverMedia: true,
    popoverWidth: 460,
  },
  house: {
    Panel: lazy(() =>
      import('./entities/house/HousePreviewPanel').then(
        ({ HousePreviewPanel }) => ({ default: HousePreviewPanel }),
      ),
    ),
    getHref: (id) => `/rental/properties/${id}`,
    popoverMedia: true,
    popoverWidth: 460,
  },
  contact: {
    Panel: lazy(() =>
      import('./entities/contact/ContactPreviewPanel').then(
        ({ ContactPreviewPanel }) => ({ default: ContactPreviewPanel }),
      ),
    ),
    getHref: (id) => `/rental/customers?preview=${id}`,
    popoverMedia: false,
    popoverWidth: 390,
  },
  lease: {
    Panel: lazy(() =>
      import('./entities/lease/LeasePreviewPanel').then(
        ({ LeasePreviewPanel }) => ({ default: LeasePreviewPanel }),
      ),
    ),
    getHref: (id) => `/rental/leases?preview=${id}`,
    popoverMedia: false,
    popoverWidth: 390,
  },
  viewing: {
    Panel: lazy(() =>
      import('./entities/viewing/ViewingPreviewPanel').then(
        ({ ViewingPreviewPanel }) => ({ default: ViewingPreviewPanel }),
      ),
    ),
    getHref: (id) => `/rental/viewings?preview=${id}`,
    popoverMedia: false,
    popoverWidth: 390,
  },
};
