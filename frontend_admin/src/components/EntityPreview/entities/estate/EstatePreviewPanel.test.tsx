import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPreview } from '../../__tests__/renderPreview';

const { getEstate, useTenantWorkspace } = vi.hoisted(() => ({
  getEstate: vi.fn(),
  useTenantWorkspace: vi.fn(),
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: { getEstate },
}));

vi.mock('@/pages/space/shared', () => ({ useTenantWorkspace }));

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
};

describe('EstatePreviewPanel', () => {
  beforeEach(() => {
    getEstate.mockReset();
    useTenantWorkspace.mockReturnValue({ selectedOrgSlug: 'org' });
  });

  it('按组织缓存项目详情并展示代表性信息', async () => {
    getEstate.mockResolvedValue(estate);

    const { queryClient } = renderPreview(
      <EstatePreviewPanel id={7} variant="popover" />,
    );

    const preview = await screen.findByRole('region', {
      name: '春风里公寓预览',
    });
    expect(within(preview).getByText('春风里公寓')).toBeInTheDocument();
    expect(getEstate).toHaveBeenCalledWith(7);
    expect(
      queryClient.getQueryData(['entity-preview', 'org', 'estate', 7]),
    ).toEqual(estate);
    expect(within(preview).getByText('公寓')).toBeInTheDocument();
    expect(
      within(preview).getByRole('img', { name: '春风里公寓' }),
    ).toHaveAttribute('src', 'https://example.com/estate.jpg');

    const details = within(preview).getByRole('region', {
      name: '预览详情内容',
    });
    expect(within(details).getByText('所在区域')).toBeInTheDocument();
    expect(
      within(details).getByText('广东省 · 深圳市 · 南山区'),
    ).toBeInTheDocument();
    expect(within(details).queryByText('省份')).not.toBeInTheDocument();
    expect(within(details).queryByText('城市')).not.toBeInTheDocument();
    expect(within(details).getByText('详细地址')).toBeInTheDocument();
    expect(within(details).getByText('科技南路 88 号')).toBeInTheDocument();
    expect(within(preview).queryByText('核心信息')).not.toBeInTheDocument();
    expect(within(preview).queryByText('补充信息')).not.toBeInTheDocument();
    expect(within(preview).queryByText('点击查看详情')).not.toBeInTheDocument();
  });

  it('没有封面时保留小区图片占位', async () => {
    getEstate.mockResolvedValue({ ...estate, images: [] });

    renderPreview(<EstatePreviewPanel id={7} variant="popover" />);

    expect(await screen.findByText('暂无小区图片')).toBeInTheDocument();
  });

  it('drawer 场景保持原有单列详情结构', async () => {
    getEstate.mockResolvedValue(estate);

    renderPreview(<EstatePreviewPanel id={7} variant="drawer" />);

    expect(
      await screen.findByText('广东省 / 深圳市 / 南山区'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: '核心信息' }),
    ).not.toBeInTheDocument();
  });
});
