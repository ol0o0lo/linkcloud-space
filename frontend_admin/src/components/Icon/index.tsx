import {
  addCollection,
  Icon as OfflineIcon,
  type IconifyJSON,
  type IconProps,
} from '@iconify/react/offline';
import iconifyCollections from '@/generated/iconify-icons.json';

for (const collection of iconifyCollections as unknown as IconifyJSON[]) {
  addCollection(collection);
}

export type { IconProps };

/**
 * 仅使用构建期生成的本地图标子集，不会回退到 Iconify 公共 API。
 */
export function Icon({ style, ...props }: IconProps) {
  return (
    <OfflineIcon
      style={{ verticalAlign: '-0.125em', ...style }}
      {...props}
    />
  );
}
