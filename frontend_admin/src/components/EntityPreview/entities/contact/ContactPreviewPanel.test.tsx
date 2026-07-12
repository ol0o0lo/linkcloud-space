import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPreview } from '../../__tests__/renderPreview';

const { getContact, useTenantWorkspace } = vi.hoisted(() => ({
  getContact: vi.fn(),
  useTenantWorkspace: vi.fn(),
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: { getContact },
}));

vi.mock('@/pages/tenant/shared', () => ({ useTenantWorkspace }));

import { ContactPreviewPanel } from './ContactPreviewPanel';

const contact = {
  id: 12,
  name: '张房东',
  phone: '13800000000',
  email: 'landlord@example.com',
  roles: ['landlord'],
  roles__mapping: ['房东'],
  notes: '优先联系',
  is_active: true,
};

describe('ContactPreviewPanel', () => {
  beforeEach(() => {
    getContact.mockReset();
    useTenantWorkspace.mockReturnValue({ selectedOrgSlug: 'org' });
  });

  it('按组织缓存联系人详情并展示代表性信息', async () => {
    getContact.mockResolvedValue(contact);

    const { queryClient } = renderPreview(<ContactPreviewPanel id={12} />);

    expect(await screen.findByText('张房东 / 13800000000')).toBeInTheDocument();
    expect(getContact).toHaveBeenCalledWith(12);
    expect(
      queryClient.getQueryData(['entity-preview', 'org', 'contact', 12]),
    ).toEqual(contact);
    expect(screen.getByText('房东')).toBeInTheDocument();
    expect(screen.getByText('landlord@example.com')).toBeInTheDocument();
    expect(screen.getByText('启用')).toBeInTheDocument();
  });
});
