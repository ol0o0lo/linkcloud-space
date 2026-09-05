import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildHouseMatchSharePayload,
  HouseMatchShareModal,
  mergeHouseMatchSelection,
} from './HouseMatchShareModal';

const {
  mockCreateHouseMatchShare,
  mockListHouseMatchShares,
  mockExtendHouseMatchShare,
  mockRevokeHouseMatchShare,
} = vi.hoisted(() => ({
  mockCreateHouseMatchShare: vi.fn(),
  mockListHouseMatchShares: vi.fn(),
  mockExtendHouseMatchShare: vi.fn(),
  mockRevokeHouseMatchShare: vi.fn(),
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: {
    createHouseMatchShare: mockCreateHouseMatchShare,
    listHouseMatchShares: mockListHouseMatchShares,
    extendHouseMatchShare: mockExtendHouseMatchShare,
    revokeHouseMatchShare: mockRevokeHouseMatchShare,
  },
}));

function renderModal() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <HouseMatchShareModal open selectedHouseIds={[8, 3]} onCancel={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe('HouseMatchShareModal', () => {
  beforeEach(() => {
    mockCreateHouseMatchShare.mockReset();
    mockListHouseMatchShares.mockReset();
    mockExtendHouseMatchShare.mockReset();
    mockRevokeHouseMatchShare.mockReset();
    mockCreateHouseMatchShare.mockResolvedValue({
      share_key: 'share-key',
      share_url:
        'https://example.com/h5/#/pages/house-match/index?key=share-key',
      expires_at: '2026-09-24T08:00:00Z',
      created_at: '2026-08-25T08:00:00Z',
    });
    mockListHouseMatchShares.mockResolvedValue({
      items: [
        {
          id: 41,
          share_key: 'history-key',
          share_url:
            'https://example.com/h5/#/pages/house-match/index?key=history-key',
          title: '历史推荐',
          mode: 'manual',
          status: 'active',
          expires_at: '2026-09-24T08:00:00Z',
          revoked_at: null,
          view_count: 3,
          last_accessed_at: '2026-08-29T08:00:00Z',
          created_at: '2026-08-25T08:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      page_size: 5,
    });
    mockExtendHouseMatchShare.mockResolvedValue({});
    mockRevokeHouseMatchShare.mockResolvedValue({});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('保留选择顺序并阻止超过 100 套', () => {
    expect(mergeHouseMatchSelection([8, 3], [3, 8, 5])).toEqual([8, 3, 5]);
    const current = Array.from({ length: 100 }, (_, index) => index + 1);
    expect(mergeHouseMatchSelection(current, [...current, 101])).toBe(current);
  });

  it('构造动态规则时不携带手工房源并支持永不过期', () => {
    expect(
      buildHouseMatchSharePayload(
        {
          title: '  南山动态配房  ',
          remark: '  实时更新  ',
          mode: 'dynamic',
          district: '南山',
          min_rent: 3000,
          sort: 'rent_asc',
          neverExpires: true,
        },
        [8, 3],
      ),
    ).toEqual({
      title: '南山动态配房',
      remark: '实时更新',
      mode: 'dynamic',
      expires_at: null,
      criteria: { district: '南山', min_rent: 3000, sort: 'rent_asc' },
    });
  });

  it('提交手工配房并显示一次性结果链接', async () => {
    renderModal();

    fireEvent.change(screen.getByLabelText('标题'), {
      target: { value: '南山精选' },
    });
    fireEvent.click(screen.getByText('生成链接'));

    await waitFor(() =>
      expect(mockCreateHouseMatchShare).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '南山精选',
          mode: 'manual',
          house_ids: [8, 3],
        }),
      ),
    );
    expect(
      await screen.findByText('链接内容不可修改，如需调整请重新生成'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('配房分享链接')).toHaveValue(
      'https://example.com/h5/#/pages/house-match/index?key=share-key',
    );

    fireEvent.click(screen.getByText('复制链接'));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'https://example.com/h5/#/pages/house-match/index?key=share-key',
      ),
    );
    expect(mockListHouseMatchShares).toHaveBeenCalledTimes(2);
  });

  it('展示历史链接并支持复制、延期和失效', async () => {
    renderModal();

    expect(await screen.findByText('历史链接')).toBeInTheDocument();
    const historyTitle = await screen.findByText('历史推荐');
    const historyRow = historyTitle.closest('tr');
    if (!historyRow) throw new Error('Expected history row to render');

    fireEvent.click(within(historyRow).getByText('复制'));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'https://example.com/h5/#/pages/house-match/index?key=history-key',
      ),
    );

    fireEvent.click(within(historyRow).getByText('延期 30 天'));
    await waitFor(() => {
      expect(mockExtendHouseMatchShare).toHaveBeenCalledWith(41, {
        expires_at: expect.any(String),
      });
      expect(mockListHouseMatchShares).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(within(historyRow).getByText('立即失效'));
    fireEvent.click(await screen.findByRole('button', { name: '确定失效' }));
    await waitFor(() => {
      expect(mockRevokeHouseMatchShare).toHaveBeenCalledWith(41);
      expect(mockListHouseMatchShares).toHaveBeenCalledTimes(3);
    });
  });
});
