import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPreview } from '../../__tests__/renderPreview';

const { getHouse, useTenantWorkspace } = vi.hoisted(() => ({
  getHouse: vi.fn(),
  useTenantWorkspace: vi.fn(),
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: { getHouse },
}));

vi.mock('@/pages/tenant/shared', () => ({ useTenantWorkspace }));

vi.mock('../building/BuildingPreview', () => ({
  BuildingPreview: ({
    children,
    id,
  }: {
    children: React.ReactNode;
    id?: number | null;
  }) => (
    <span data-preview="building" data-id={id}>
      {children}
    </span>
  ),
}));

import { HousePreviewPanel } from './HousePreviewPanel';

const house = {
  id: 9,
  building_id: 3,
  building: {
    id: 3,
    name: '2 号楼',
    estate: { id: 1, name: '春风里', display_name: '春风里公寓' },
  },
  landlord_id: 5,
  landlord: { id: 5, name: '张房东', phone: '13800000000' },
  room_number: '901',
  floor: 9,
  area: '89.5',
  asking_rent: '5200.00',
  deposit_amount: '10400.00',
  bedrooms: 3,
  living_rooms: 2,
  bathrooms: 2,
  kitchens: 1,
  balconies: 1,
  orientation: 'south',
  orientation__mapping: '南',
  decoration: 'fine',
  decoration__mapping: '精装',
  has_elevator_access: true,
  status: 'listed',
  status__mapping: '招租中',
  images: [{ image_role: 'cover', thumbnail: 'https://example.com/house.jpg' }],
  tags: ['自有标签'],
  effective_tags: ['近地铁', '随时看房'],
  public_description: '采光充足，拎包入住',
  internal_notes: '工作日晚间可安排看房',
};

describe('HousePreviewPanel', () => {
  beforeEach(() => {
    getHouse.mockReset();
    useTenantWorkspace.mockReturnValue({ selectedOrgSlug: 'org' });
  });

  it('按组织缓存房源详情并展示代表性信息', async () => {
    getHouse.mockResolvedValue(house);

    const { queryClient } = renderPreview(
      <HousePreviewPanel id={9} variant="popover" />,
    );

    const preview = await screen.findByRole('region', {
      name: '春风里公寓 / 2 号楼 / 901预览',
    });
    expect(getHouse).toHaveBeenCalledWith(9);
    expect(
      queryClient.getQueryData(['entity-preview', 'org', 'house', 9]),
    ).toEqual(house);
    expect(within(preview).getByText('¥5200.00')).toBeInTheDocument();
    expect(within(preview).getByText('押金 ¥10400.00')).toBeInTheDocument();
    expect(within(preview).getByText('招租中')).toBeInTheDocument();
    const cover = within(preview).getByAltText('春风里公寓 / 2 号楼 / 901');
    expect(cover).toHaveAttribute('src', 'https://example.com/house.jpg');
    expect(cover).toHaveAttribute('height', '124');

    const details = within(preview).getByRole('region', {
      name: '预览详情内容',
    });
    expect(within(details).getByText('3室2厅2卫')).toBeInTheDocument();
    expect(within(details).getByText('89.5㎡')).toBeInTheDocument();
    expect(within(details).getByText('9 层 / 南')).toBeInTheDocument();
    expect(
      within(details).getByText('春风里公寓 / 2 号楼'),
    ).toBeInTheDocument();
    expect(
      within(details).getByText('张房东 / 13800000000'),
    ).toBeInTheDocument();
    expect(
      within(details).getByText('精装、电梯可达、1 厨、1 阳台'),
    ).toBeInTheDocument();
    expect(
      within(details).getByText('工作日晚间可安排看房'),
    ).toBeInTheDocument();
    expect(within(preview).queryByText('精装')).not.toBeInTheDocument();
    expect(within(details).getByText('标签')).toBeInTheDocument();
    expect(within(details).getByText('近地铁 · 随时看房')).toBeInTheDocument();
    expect(within(details).queryByText('公开描述')).not.toBeInTheDocument();
    expect(
      within(details).queryByText('采光充足，拎包入住'),
    ).not.toBeInTheDocument();
    expect(within(details).queryByText('详细地址')).not.toBeInTheDocument();
    expect(within(preview).queryByText('核心信息')).not.toBeInTheDocument();
    expect(within(preview).queryByText('补充信息')).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-preview="building"][data-id="3"]'),
    ).not.toBeInTheDocument();

    expect(details).toHaveAttribute('tabindex', '0');
    expect(details).toHaveAttribute('data-entity-preview-scroll');
    expect(getComputedStyle(details).overflowY).toBe('auto');
  });

  it('使用高密度的媒体、摘要、内容和网格间距', async () => {
    getHouse.mockResolvedValue(house);

    renderPreview(<HousePreviewPanel id={9} variant="popover" />);

    const preview = await screen.findByRole('region', {
      name: '春风里公寓 / 2 号楼 / 901预览',
    });
    const header = preview.querySelector('header');
    const footer = preview.querySelector('footer');
    const details = within(preview).getByRole('region', {
      name: '预览详情内容',
    });
    const content = details.firstElementChild;
    const factGrid =
      within(details).getByText('户型').parentElement?.parentElement;

    expect(header).not.toBeNull();
    expect(getComputedStyle(header as HTMLElement).paddingTop).toBe('8px');
    expect(getComputedStyle(header as HTMLElement).paddingRight).toBe('12px');
    expect(getComputedStyle(content as HTMLElement).paddingTop).toBe('8px');
    expect(getComputedStyle(content as HTMLElement).paddingRight).toBe('12px');
    expect(getComputedStyle(content as HTMLElement).paddingBottom).toBe('8px');
    expect(getComputedStyle(factGrid as HTMLElement).gap).toBe('8px 12px');
    expect(footer).not.toBeNull();
    expect(getComputedStyle(footer as HTMLElement).paddingTop).toBe('4px');
    expect(getComputedStyle(footer as HTMLElement).paddingRight).toBe('12px');
    expect(within(preview).getByText('¥5200.00')).toHaveStyle({
      fontSize: '18px',
    });
  });

  it('drawer 场景保留楼栋嵌套预览', async () => {
    getHouse.mockResolvedValue(house);

    renderPreview(<HousePreviewPanel id={9} variant="drawer" />);

    expect(
      await screen.findByText('春风里公寓 / 2 号楼 / 901'),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-preview="building"][data-id="3"]'),
    ).toHaveTextContent('春风里公寓 / 2 号楼');
  });

  it('没有封面时保留房源图片占位', async () => {
    getHouse.mockResolvedValue({ ...house, images: [] });

    renderPreview(<HousePreviewPanel id={9} variant="popover" />);

    const placeholder = (await screen.findByText('暂无房源图片')).closest(
      'div',
    );
    expect(placeholder).not.toBeNull();
    expect(getComputedStyle(placeholder as HTMLDivElement).height).toBe(
      '124px',
    );
    expect(getComputedStyle(placeholder as HTMLDivElement).flexBasis).toBe(
      '124px',
    );
    expect(getComputedStyle(placeholder as HTMLDivElement).flexShrink).toBe(
      '0',
    );
  });

  it('没有真实补充数据时不渲染空字段', async () => {
    getHouse.mockResolvedValue({
      ...house,
      balconies: null,
      building: { ...house.building, address: null },
      decoration: null,
      decoration__mapping: null,
      effective_tags: [],
      has_elevator_access: false,
      internal_notes: null,
      kitchens: null,
      public_description: null,
      tags: [],
    });

    renderPreview(<HousePreviewPanel id={9} variant="popover" />);

    const preview = await screen.findByRole('region', {
      name: '春风里公寓 / 2 号楼 / 901预览',
    });
    expect(within(preview).queryByText('配套')).not.toBeInTheDocument();
  });

  it('房源 Popover 加载时保留媒体骨架', () => {
    getHouse.mockReturnValue(
      new Promise(() => {
        // 保持 React Query pending 状态
      }),
    );

    renderPreview(<HousePreviewPanel id={9} variant="popover" />);

    expect(
      screen.getByTestId('entity-preview-skeleton-media'),
    ).toBeInTheDocument();
  });

  it('一般错误时可重新加载详情', async () => {
    getHouse
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(house);

    renderPreview(<HousePreviewPanel id={9} variant="popover" />);

    expect(await screen.findByText('详情加载失败')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新加载' }));

    await waitFor(() => expect(getHouse).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByText('春风里公寓 / 2 号楼 / 901'),
    ).toBeInTheDocument();
  });
});
