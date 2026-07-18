import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPreview } from '../../__tests__/renderPreview';

const { getBuilding, useTenantWorkspace } = vi.hoisted(() => ({
  getBuilding: vi.fn(),
  useTenantWorkspace: vi.fn(),
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: { getBuilding },
}));

vi.mock('@/pages/tenant/shared', () => ({ useTenantWorkspace }));

import { BuildingPreviewPanel } from './BuildingPreviewPanel';

const building = {
  id: 12,
  estate_id: 7,
  estate: { id: 7, name: '春风里', display_name: '春风里公寓' },
  name: '2 号楼',
  floors: 28,
  under_floors: 2,
  year_built: 2021,
  elevator: true,
  lat: null,
  lng: null,
  address: '科技南路 88 号 2 栋',
  images: [
    {
      media_id: 1,
      media_type: 'image',
      url: '/building.jpg',
      thumbnail: '/building-thumb.jpg',
    },
  ],
  tags: ['近地铁'],
};

describe('BuildingPreviewPanel', () => {
  beforeEach(() => {
    getBuilding.mockReset();
    useTenantWorkspace.mockReturnValue({ selectedOrgSlug: 'org' });
  });

  it('按组织缓存楼栋详情并展示代表性信息', async () => {
    getBuilding.mockResolvedValue(building);

    const { queryClient } = renderPreview(
      <BuildingPreviewPanel id={12} variant="popover" />,
    );

    const preview = await screen.findByRole('region', {
      name: '春风里公寓 / 2 号楼预览',
    });
    expect(getBuilding).toHaveBeenCalledWith(12);
    expect(
      queryClient.getQueryData(['entity-preview', 'org', 'building', 12]),
    ).toEqual(building);
    expect(
      within(preview).getByText('春风里公寓 / 2 号楼'),
    ).toBeInTheDocument();
    expect(within(preview).getByAltText('2 号楼')).toHaveAttribute(
      'src',
      '/building-thumb.jpg',
    );

    const details = within(preview).getByRole('region', {
      name: '预览详情内容',
    });
    expect(within(details).getByText('所属小区')).toBeInTheDocument();
    expect(within(details).getByText('总楼层')).toBeInTheDocument();
    expect(within(details).getByText('28 层')).toBeInTheDocument();
    expect(within(details).getByText('地下楼层')).toBeInTheDocument();
    expect(within(details).getByText('2 层')).toBeInTheDocument();
    expect(within(details).getByText('建成年份')).toBeInTheDocument();
    expect(within(details).getByText('2021 年')).toBeInTheDocument();
    expect(within(details).getByText('有电梯')).toBeInTheDocument();
    expect(
      within(details).getByText('科技南路 88 号 2 栋'),
    ).toBeInTheDocument();
    expect(within(details).getByText('近地铁')).toBeInTheDocument();
    expect(within(preview).queryByText('核心信息')).not.toBeInTheDocument();
    expect(within(preview).queryByText('补充信息')).not.toBeInTheDocument();
  });

  it('未关联项目的楼栋仍可显示预览', async () => {
    getBuilding.mockResolvedValue({
      ...building,
      estate_id: null,
      estate: null,
    });

    renderPreview(<BuildingPreviewPanel id={12} variant="popover" />);

    expect(await screen.findByText('未关联项目')).toBeInTheDocument();
  });

  it('封面加载失败时降级为楼栋图片占位', async () => {
    getBuilding.mockResolvedValue(building);

    renderPreview(<BuildingPreviewPanel id={12} variant="popover" />);

    fireEvent.error(await screen.findByAltText('2 号楼'));
    expect(await screen.findByText('暂无楼栋图片')).toBeInTheDocument();
  });
});
