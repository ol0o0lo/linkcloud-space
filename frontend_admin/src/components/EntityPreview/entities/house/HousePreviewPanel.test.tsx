import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPreview } from '../../__tests__/renderPreview';

const { getHouse, useTenantWorkspace } = vi.hoisted(() => ({
  getHouse: vi.fn(),
  useTenantWorkspace: vi.fn(),
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: { getHouse },
}));

vi.mock('@/pages/space/shared', () => ({ useTenantWorkspace }));

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
    elevator: true,
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
  status__mapping: '招租',
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

  it('按组织缓存房源详情', async () => {
    getHouse.mockResolvedValue(house);

    const { queryClient } = renderPreview(
      <HousePreviewPanel id={9} variant="popover" />,
    );

    await screen.findByRole('region', {
      name: '春风里公寓 / 2 号楼 / 901预览',
    });
    expect(getHouse).toHaveBeenCalledWith(9);
    expect(
      queryClient.getQueryData(['entity-preview', 'org', 'house', 9]),
    ).toEqual(house);
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
