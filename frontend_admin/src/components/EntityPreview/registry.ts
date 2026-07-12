import { lazy } from 'react';
import type { EntityPreviewRegistry } from './types';

export const entityPreviewRegistry: EntityPreviewRegistry = {
  house: {
    Panel: lazy(() =>
      import('./entities/house/HousePreviewPanel').then(
        ({ HousePreviewPanel }) => ({ default: HousePreviewPanel }),
      ),
    ),
    getHref: (id) => `/property-rental/houses/${id}`,
  },
};
