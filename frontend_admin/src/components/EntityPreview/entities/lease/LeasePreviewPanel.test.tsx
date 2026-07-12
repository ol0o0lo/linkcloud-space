import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPreview } from '../../__tests__/renderPreview';

const { getLease, useTenantWorkspace } = vi.hoisted(() => ({
  getLease: vi.fn(),
  useTenantWorkspace: vi.fn(),
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: { getLease },
}));

vi.mock('@/pages/tenant/shared', () => ({ useTenantWorkspace }));

import { LeasePreviewPanel } from './LeasePreviewPanel';

const lease = {
  id: 21,
  house_id: 9,
  house: {
    id: 9,
    label: '春风里公寓 / 2 号楼 / 901',
    room_number: '901',
    building_id: 3,
    building: { id: 3, name: '2 号楼', estate: { id: 1, name: '春风里' } },
  },
  tenant_id: 8,
  tenant: { id: 8, name: '李租客', phone: '13900000000' },
  source_viewing_record_id: null,
  source_viewing_record: null,
  sign_at: '2026-06-20T10:00:00+08:00',
  start_date: '2026-07-01',
  end_date: '2027-06-30',
  monthly_rent: '5200.00',
  deposit: '10400.00',
  payment_day: 5,
  status: 'active',
  status__mapping: '生效中',
  contract_files: [{ media_id: 1 }, { media_id: 2 }],
  notes: '',
  extra: {},
};

describe('LeasePreviewPanel', () => {
  beforeEach(() => {
    getLease.mockReset();
    useTenantWorkspace.mockReturnValue({ selectedOrgSlug: 'org' });
  });

  it('按组织缓存租约详情并展示代表性信息', async () => {
    getLease.mockResolvedValue(lease);

    const { queryClient } = renderPreview(<LeasePreviewPanel id={21} />);

    expect(
      await screen.findByText('春风里公寓 / 2 号楼 / 901'),
    ).toBeInTheDocument();
    expect(getLease).toHaveBeenCalledWith(21);
    expect(
      queryClient.getQueryData(['entity-preview', 'org', 'lease', 21]),
    ).toEqual(lease);
    expect(screen.getByText('李租客 / 13900000000')).toBeInTheDocument();
    expect(screen.getByText('2026-07-01 至 2027-06-30')).toBeInTheDocument();
    expect(screen.getByText('¥5200.00')).toBeInTheDocument();
    expect(screen.getByText('生效中')).toBeInTheDocument();
    expect(screen.getByText('2 份')).toBeInTheDocument();
  });
});
