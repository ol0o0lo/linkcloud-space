import {
  ApartmentOutlined,
  BankOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import {
  housePrimaryLayoutText,
  mediaCoverUrl,
  moneyText,
} from '@/pages/property-rental/constants';
import type {
  FavoriteBuildingTarget,
  FavoriteEstateTarget,
  FavoriteHouseTarget,
  FavoriteItem,
} from '@/services/manual/favorites';
import {
  registerFavoriteTargetDefinition,
  renderGenericFavoriteTarget,
} from '../targetRegistry';

function isHouseTarget(
  item: FavoriteItem,
): item is FavoriteItem & { target: FavoriteHouseTarget } {
  if (item.target_type !== 'house' || !item.target) return false;
  const target = item.target as Partial<FavoriteHouseTarget>;
  return typeof target.room_number === 'string' && Boolean(target.building);
}

function isBuildingTarget(
  item: FavoriteItem,
): item is FavoriteItem & { target: FavoriteBuildingTarget } {
  if (item.target_type !== 'building' || !item.target) return false;
  const target = item.target as Partial<FavoriteBuildingTarget>;
  return typeof target.name === 'string' && typeof target.address === 'string';
}

function isEstateTarget(
  item: FavoriteItem,
): item is FavoriteItem & { target: FavoriteEstateTarget } {
  if (item.target_type !== 'estate' || !item.target) return false;
  const target = item.target as Partial<FavoriteEstateTarget>;
  return typeof target.name === 'string' && typeof target.address === 'string';
}

function uniqueTags(tags: string[]) {
  return [...new Set(tags.filter(Boolean))];
}

registerFavoriteTargetDefinition({
  targetType: 'house',
  defaultDisplayName: '房源',
  icon: <HomeOutlined aria-hidden />,
  description: '把心仪的房间留在这里，随时回来比较租金、户型与位置。',
  emptyTitle: '还没有收藏房源',
  emptyDescription: '看到心仪房源时，点亮红心就能在这里快速找到。',
  renderer: (item, metadata) => {
    if (!isHouseTarget(item))
      return renderGenericFavoriteTarget(item, metadata);
    const house = item.target;
    const estateName =
      house.building.estate?.display_name || house.building.estate?.name;
    return {
      title:
        [estateName, house.building.name, house.room_number]
          .filter(Boolean)
          .join(' · ') ||
        item.display?.title ||
        '房源收藏',
      subtitle:
        house.building.address || item.display?.subtitle || '地址待补充',
      coverUrl:
        mediaCoverUrl(house.images) || item.display?.cover_url || undefined,
      publisher: house.publisher?.name,
      description:
        house.public_description || item.display?.description || undefined,
      tags: uniqueTags(
        house.effective_tags || house.tags || item.display?.tags || [],
      ),
      facts: [
        {
          label: '月租',
          value: `${moneyText(house.asking_rent)}/月`,
          emphasis: true,
        },
        { label: '户型', value: housePrimaryLayoutText(house) },
        {
          label: '面积',
          value: house.area ? `${house.area}㎡` : '面积待补充',
        },
      ],
    };
  },
});

registerFavoriteTargetDefinition({
  targetType: 'building',
  defaultDisplayName: '楼栋',
  icon: <ApartmentOutlined aria-hidden />,
  description: '按楼栋整理你的居住偏好，集中查看位置、楼层与配套。',
  emptyTitle: '还没有收藏楼栋',
  emptyDescription: '收藏感兴趣的楼栋，之后比较房源时会更省心。',
  renderer: (item, metadata) => {
    if (!isBuildingTarget(item)) {
      return renderGenericFavoriteTarget(item, metadata);
    }
    const building = item.target;
    return {
      title:
        [building.estate?.display_name || building.estate?.name, building.name]
          .filter(Boolean)
          .join(' · ') ||
        item.display?.title ||
        '楼栋收藏',
      subtitle: building.address || item.display?.subtitle || '楼栋地址待补充',
      coverUrl:
        mediaCoverUrl(building.images) || item.display?.cover_url || undefined,
      publisher: building.publisher?.name,
      description: item.display?.description || undefined,
      tags: uniqueTags(building.tags || item.display?.tags || []),
      facts: [
        { label: '楼层', value: `${building.floors} 层` },
        {
          label: '电梯',
          value: building.elevator ? '配备电梯' : '暂无电梯',
        },
      ],
    };
  },
});

registerFavoriteTargetDefinition({
  targetType: 'estate',
  defaultDisplayName: '小区',
  icon: <BankOutlined aria-hidden />,
  description: '保留喜欢的小区，慢慢比较区域环境与社区氛围。',
  emptyTitle: '还没有收藏小区',
  emptyDescription: '遇到喜欢的小区时，点亮红心把它保存到这里。',
  renderer: (item, metadata) => {
    if (!isEstateTarget(item))
      return renderGenericFavoriteTarget(item, metadata);
    const estate = item.target;
    return {
      title:
        estate.display_name || estate.name || item.display?.title || '小区收藏',
      subtitle:
        [estate.province, estate.city, estate.district, estate.address]
          .filter(Boolean)
          .join(' · ') ||
        item.display?.subtitle ||
        '小区地址待补充',
      coverUrl:
        mediaCoverUrl(estate.images) || item.display?.cover_url || undefined,
      publisher: estate.publisher?.name,
      description: estate.description || item.display?.description || undefined,
      tags: uniqueTags(item.display?.tags || []),
      facts:
        item.display?.facts?.map((fact) => ({
          label: fact.label,
          value: fact.value,
        })) || [],
    };
  },
});
