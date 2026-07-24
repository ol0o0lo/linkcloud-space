import { HeartOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import type {
  FavoriteItem,
  FavoriteTargetType,
} from '@/services/manual/favorites';

export type FavoriteCardFact = {
  label: string;
  value: string;
  emphasis?: boolean;
};

export type FavoriteCardPresentation = {
  title: string;
  subtitle: string;
  coverUrl?: string;
  publisher?: string;
  description?: string;
  tags: string[];
  facts: FavoriteCardFact[];
};

export type FavoriteTargetDefinition = {
  targetType: string;
  defaultDisplayName: string;
  icon: ReactNode;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  renderer: (
    item: FavoriteItem,
    metadata: FavoriteTargetType,
  ) => FavoriteCardPresentation;
};

export type ResolvedFavoriteTargetDefinition = FavoriteTargetDefinition & {
  metadata: FavoriteTargetType;
  displayName: string;
};

const targetDefinitions = new Map<string, FavoriteTargetDefinition>();

export function registerFavoriteTargetDefinition(
  definition: FavoriteTargetDefinition,
) {
  targetDefinitions.set(definition.targetType, definition);
}

export function renderGenericFavoriteTarget(
  item: FavoriteItem,
  metadata: FavoriteTargetType,
): FavoriteCardPresentation {
  const display = item.display;
  return {
    title: display?.title || `${metadata.display_name}收藏`,
    subtitle:
      display?.subtitle ||
      (item.available ? '详情信息待补充' : '该内容当前不再公开'),
    coverUrl: display?.cover_url || undefined,
    description: display?.description || undefined,
    tags: display?.tags || [],
    facts:
      display?.facts?.map((fact) => ({
        label: fact.label,
        value: fact.value,
      })) || [],
  };
}

function genericDefinition(
  metadata: FavoriteTargetType,
): FavoriteTargetDefinition {
  return {
    targetType: metadata.target_type,
    defaultDisplayName: metadata.display_name,
    icon: <HeartOutlined aria-hidden />,
    description: `集中查看你收藏的${metadata.display_name}，随时回来继续了解。`,
    emptyTitle: `还没有收藏${metadata.display_name}`,
    emptyDescription: `收藏感兴趣的${metadata.display_name}后，就能在这里快速找到。`,
    renderer: renderGenericFavoriteTarget,
  };
}

export function resolveFavoriteTargetDefinition(
  metadata: FavoriteTargetType,
): ResolvedFavoriteTargetDefinition {
  const definition =
    targetDefinitions.get(metadata.target_type) || genericDefinition(metadata);
  return {
    ...definition,
    metadata,
    displayName: metadata.display_name || definition.defaultDisplayName,
  };
}

export function normalizeFavoriteTargetTypes(types: FavoriteTargetType[]) {
  const deduplicated = new Map<string, FavoriteTargetType>();
  for (const type of types) {
    if (!type.target_type || deduplicated.has(type.target_type)) continue;
    deduplicated.set(type.target_type, type);
  }
  return [...deduplicated.values()].sort(
    (left, right) =>
      left.order - right.order ||
      left.display_name.localeCompare(right.display_name, 'zh-CN'),
  );
}
