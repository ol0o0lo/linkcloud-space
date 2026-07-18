import { screen, within } from '@testing-library/react';
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

  it('按组织缓存联系人详情并展示分区悬浮预览', async () => {
    getContact.mockResolvedValue(contact);

    const { queryClient } = renderPreview(
      <ContactPreviewPanel id={12} variant="popover" />,
    );

    const preview = await screen.findByRole('region', {
      name: '张房东预览',
    });
    expect(getContact).toHaveBeenCalledWith(12);
    expect(
      queryClient.getQueryData(['entity-preview', 'org', 'contact', 12]),
    ).toEqual(contact);
    const avatar = within(preview).getByText('张').closest('.ant-avatar');
    expect(avatar).not.toBeNull();
    expect(getComputedStyle(avatar as HTMLElement).width).toBe('36px');
    expect(getComputedStyle(avatar as HTMLElement).height).toBe('36px');
    expect(
      getComputedStyle(
        preview.querySelector('header')?.parentElement as HTMLElement,
      ).paddingTop,
    ).toBe('16px');
    expect(within(preview).getByText('张房东')).toBeInTheDocument();
    expect(within(preview).getByText('13800000000')).toBeInTheDocument();
    expect(within(preview).getByText('启用')).toBeInTheDocument();

    const details = within(preview).getByRole('region', {
      name: '预览详情内容',
    });
    expect(within(details).getByText('角色')).toBeInTheDocument();
    expect(within(details).getByText('房东')).toBeInTheDocument();
    expect(within(details).getByText('邮箱')).toBeInTheDocument();
    expect(
      within(details).getByText('landlord@example.com'),
    ).toBeInTheDocument();
    expect(within(details).getByText('备注')).toBeInTheDocument();
    expect(within(details).getByText('优先联系')).toBeInTheDocument();
    expect(within(preview).queryByText('核心信息')).not.toBeInTheDocument();
    expect(within(preview).queryByText('补充信息')).not.toBeInTheDocument();
    expect(within(preview).queryByText('点击查看详情')).not.toBeInTheDocument();
  });

  it('drawer 场景保持原有单列详情结构', async () => {
    getContact.mockResolvedValue(contact);

    renderPreview(<ContactPreviewPanel id={12} variant="drawer" />);

    expect(await screen.findByText('张房东 / 13800000000')).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: '核心信息' }),
    ).not.toBeInTheDocument();
  });

  it('联系人 Popover 加载时不渲染媒体骨架', () => {
    getContact.mockReturnValue(
      new Promise(() => {
        // 保持 React Query pending 状态
      }),
    );

    renderPreview(<ContactPreviewPanel id={12} variant="popover" />);

    expect(
      screen.getByRole('status', { name: '正在加载预览' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('entity-preview-skeleton-media'),
    ).not.toBeInTheDocument();
  });
});
