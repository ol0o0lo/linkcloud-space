import type { ComponentType, LazyExoticComponent, ReactNode } from 'react';

export type EntityPreviewType =
  | 'house'
  | 'estate'
  | 'building'
  | 'contact'
  | 'lease'
  | 'viewing';

export type EntityPreviewId = number;

export type EntityPreviewVariant = 'popover' | 'drawer';

export interface EntityPreviewPanelProps {
  id: EntityPreviewId;
  variant: EntityPreviewVariant;
}

export interface EntityPreviewEntryProps {
  id?: EntityPreviewId | null;
  children: ReactNode;
  href?: string;
}

export interface EntityPreviewProps extends EntityPreviewEntryProps {
  type: EntityPreviewType;
}

export interface EntityPreviewDefinition {
  Panel: LazyExoticComponent<ComponentType<EntityPreviewPanelProps>>;
  getHref: (id: EntityPreviewId) => string;
  popoverMedia: boolean;
  popoverWidth: number;
}

export type EntityPreviewRegistry = Partial<
  Record<EntityPreviewType, EntityPreviewDefinition>
>;
