import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPreview } from '../../__tests__/renderPreview';

const { getBuilding, useTenantWorkspace } = vi.hoisted(() => ({
  getBuilding: vi.fn(),
  useTenantWorkspace: vi.fn(),
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: { getBuilding },
}));

vi.mock('@/pages/space/shared', () => ({ useTenantWorkspace }));

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

  it('按组织缓存楼栋详情', async () => {
    getBuilding.mockResolvedValue(building);

    const { queryClient } = renderPreview(
      <BuildingPreviewPanel id={12} variant="popover" />,
    );

    await screen.findByRole('region', {
      name: '春风里公寓 / 2 号楼预览',
    });
    expect(getBuilding).toHaveBeenCalledWith(12);
    expect(
      queryClient.getQueryData(['entity-preview', 'org', 'building', 12]),
    ).toEqual(building);
  });
});
