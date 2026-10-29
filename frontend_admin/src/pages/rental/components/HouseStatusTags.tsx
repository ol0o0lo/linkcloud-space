import { Space } from 'antd';
import { AppStatusTag } from '@/components/AppStatus';
import type { HouseOut } from '@/services/manual/house';
import { HOUSE_STATUS_OPTIONS } from '../constants';

export function HouseStatusTags({
  house,
}: {
  house: Pick<HouseOut, 'is_active'> & {
    status: string;
    status__mapping?: string;
  };
}) {
  return (
    <Space size={4} wrap>
      <AppStatusTag name="house" state={house.status}>
        {HOUSE_STATUS_OPTIONS.find((option) => option.value === house.status)
          ?.label ||
          house.status__mapping ||
          '-'}
      </AppStatusTag>
      {house.is_active === false ? (
        <AppStatusTag name="house-marker" state="inactive">
          已停用
        </AppStatusTag>
      ) : null}
    </Space>
  );
}
