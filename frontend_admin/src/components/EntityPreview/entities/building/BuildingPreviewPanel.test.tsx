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
  is_active: true,
};

describe('BuildingPreviewPanel', () => {
  beforeEach(() => {
    getBuilding.mockReset();
    useTenantWorkspace.mockReturnValue({ selectedOrgSlug: 'org' });
  });

  it('按组织缓存楼栋详情并展示代表性信息', async () => {
    getBuilding.mockResolvedValue(building);

    const { queryClient } = renderPreview(<BuildingPreviewPanel id={12} />);

    expect(await screen.findByText('春风里公寓 / 2 号楼')).toBeInTheDocument();
    expect(getBuilding).toHaveBeenCalledWith(12);
    expect(
      queryClient.getQueryData(['entity-preview', 'org', 'building', 12]),
    ).toEqual(building);
    expect(screen.getByText('28 层 / 地下 2 层 / 2021 年')).toBeInTheDocument();
    expect(screen.getByText('有电梯')).toBeInTheDocument();
    expect(screen.getByText('科技南路 88 号 2 栋')).toBeInTheDocument();
  });
});
