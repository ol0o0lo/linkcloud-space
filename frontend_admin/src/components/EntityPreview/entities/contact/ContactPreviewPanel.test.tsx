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

vi.mock('@/pages/space/shared', () => ({ useTenantWorkspace }));

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

  it('按组织缓存联系人详情', async () => {
    getContact.mockResolvedValue(contact);

    const { queryClient } = renderPreview(
      <ContactPreviewPanel id={12} variant="popover" />,
    );

    await screen.findByRole('region', {
      name: '张房东预览',
    });
    expect(getContact).toHaveBeenCalledWith(12);
    expect(
      queryClient.getQueryData(['entity-preview', 'org', 'contact', 12]),
    ).toEqual(contact);
  });
});
