import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPreview } from '../../__tests__/renderPreview';

const { getViewingRecord, useTenantWorkspace } = vi.hoisted(() => ({
  getViewingRecord: vi.fn(),
  useTenantWorkspace: vi.fn(),
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: { getViewingRecord },
}));

vi.mock('@/pages/space/shared', () => ({ useTenantWorkspace }));

import { ViewingPreviewPanel } from './ViewingPreviewPanel';

const viewing = {
  id: 31,
  house_id: 9,
  house: {
    id: 9,
    label: '春风里公寓 / 2 号楼 / 901',
    room_number: '901',
    building_id: 3,
    building: { id: 3, name: '2 号楼', estate: { id: 1, name: '春风里' } },
  },
  contact_id: 8,
  contact: { id: 8, name: '李联系人', phone: '13800000000' },
  customer_name: '王客户',
  customer_phone: '13900000000',
  scheduled_at: '2026-07-08T10:00:00',
  viewed_at: '2026-07-08T10:35:00',
  status: 'converted',
  status__mapping: '已成交',
  assigned_to_id: 5,
  notes: '客户偏好朝南两居室',
  extra: {},
  is_active: true,
  signed_lease_id: 12,
};

describe('ViewingPreviewPanel', () => {
  beforeEach(() => {
    getViewingRecord.mockReset();
    useTenantWorkspace.mockReturnValue({ selectedOrgSlug: 'org' });
  });

  it('按组织缓存带看详情', async () => {
    getViewingRecord.mockResolvedValue(viewing);

    const { queryClient } = renderPreview(
      <ViewingPreviewPanel id={31} variant="popover" />,
    );

    await screen.findByRole('region', {
      name: '王客户带看预览',
    });
    expect(getViewingRecord).toHaveBeenCalledWith(31);
    expect(
      queryClient.getQueryData(['entity-preview', 'org', 'viewing', 31]),
    ).toEqual(viewing);
  });

  it('未生成租约时在悬浮预览中显示未签约', async () => {
    getViewingRecord.mockResolvedValue({ ...viewing, signed_lease_id: null });

    renderPreview(<ViewingPreviewPanel id={31} variant="popover" />);

    expect(await screen.findByText('未签约')).toBeInTheDocument();
    expect(screen.queryByText('已签约')).not.toBeInTheDocument();
  });
});
