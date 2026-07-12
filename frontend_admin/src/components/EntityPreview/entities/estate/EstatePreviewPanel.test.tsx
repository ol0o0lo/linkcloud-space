import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPreview } from '../../__tests__/renderPreview';

const { getEstate, useTenantWorkspace } = vi.hoisted(() => ({
  getEstate: vi.fn(),
  useTenantWorkspace: vi.fn(),
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: { getEstate },
}));

vi.mock('@/pages/tenant/shared', () => ({ useTenantWorkspace }));

import { EstatePreviewPanel } from './EstatePreviewPanel';

const estate = {
  id: 7,
  name: '春风里',
  display_name: '春风里公寓',
  property_type: 'apartment',
  property_type__mapping: '公寓',
  province: '广东省',
  city: '深圳市',
  district: '南山区',
  address: '科技南路 88 号',
  lat: null,
  lng: null,
  images: [
    { image_role: 'cover', thumbnail: 'https://example.com/estate.jpg' },
  ],
  is_active: true,
};

describe('EstatePreviewPanel', () => {
  beforeEach(() => {
    getEstate.mockReset();
    useTenantWorkspace.mockReturnValue({ selectedOrgSlug: 'org' });
  });

  it('按组织缓存项目详情并展示代表性信息', async () => {
    getEstate.mockResolvedValue(estate);

    const { queryClient } = renderPreview(<EstatePreviewPanel id={7} />);

    expect(await screen.findByText('春风里公寓')).toBeInTheDocument();
    expect(getEstate).toHaveBeenCalledWith(7);
    expect(
      queryClient.getQueryData(['entity-preview', 'org', 'estate', 7]),
    ).toEqual(estate);
    expect(screen.getByText('公寓')).toBeInTheDocument();
    expect(screen.getByText('广东省 / 深圳市 / 南山区')).toBeInTheDocument();
    expect(screen.getByText('启用')).toBeInTheDocument();
  });
});
