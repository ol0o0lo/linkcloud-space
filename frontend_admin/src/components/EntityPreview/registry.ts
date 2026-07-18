import { lazy } from 'react';
import type { EntityPreviewRegistry } from './types';

export const entityPreviewRegistry: EntityPreviewRegistry = {
  estate: {
    Panel: lazy(() =>
      import('./entities/estate/EstatePreviewPanel').then(
        ({ EstatePreviewPanel }) => ({ default: EstatePreviewPanel }),
      ),
    ),
    getHref: (id) => `/property-rental/estates?preview_estate=${id}`,
    popoverMedia: true,
    popoverWidth: 460,
  },
  building: {
    Panel: lazy(() =>
      import('./entities/building/BuildingPreviewPanel').then(
        ({ BuildingPreviewPanel }) => ({ default: BuildingPreviewPanel }),
      ),
    ),
    getHref: (id) =>
      `/property-rental/estates?view=buildings&preview_building=${id}`,
    popoverMedia: true,
    popoverWidth: 460,
  },
  house: {
    Panel: lazy(() =>
      import('./entities/house/HousePreviewPanel').then(
        ({ HousePreviewPanel }) => ({ default: HousePreviewPanel }),
      ),
    ),
    getHref: (id) => `/property-rental/houses/${id}`,
    popoverMedia: true,
    popoverWidth: 460,
  },
  contact: {
    Panel: lazy(() =>
      import('./entities/contact/ContactPreviewPanel').then(
        ({ ContactPreviewPanel }) => ({ default: ContactPreviewPanel }),
      ),
    ),
    getHref: (id) => `/property-rental/contacts?preview=${id}`,
    popoverMedia: false,
    popoverWidth: 390,
  },
  lease: {
    Panel: lazy(() =>
      import('./entities/lease/LeasePreviewPanel').then(
        ({ LeasePreviewPanel }) => ({ default: LeasePreviewPanel }),
      ),
    ),
    getHref: (id) => `/property-rental/leases?preview=${id}`,
    popoverMedia: false,
    popoverWidth: 390,
  },
  viewing: {
    Panel: lazy(() =>
      import('./entities/viewing/ViewingPreviewPanel').then(
        ({ ViewingPreviewPanel }) => ({ default: ViewingPreviewPanel }),
      ),
    ),
    getHref: (id) => `/property-rental/viewings?preview=${id}`,
    popoverMedia: false,
    popoverWidth: 390,
  },
};
