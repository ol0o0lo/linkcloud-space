import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetFavorites, mockPutFavorite, mockRemoveFavorite } = vi.hoisted(
  () => ({
    mockGetFavorites: vi.fn(),
    mockPutFavorite: vi.fn(),
    mockRemoveFavorite: vi.fn(),
  }),
);

vi.mock('./favorites', () => ({
  getMyFavorites: mockGetFavorites,
  putFavorite: mockPutFavorite,
  removeFavorite: mockRemoveFavorite,
}));

import { favoriteKeys, useFavoriteState, useToggleFavorite } from './favoriteHooks';

function FavoriteHarness() {
  const state = useFavoriteState('house', 18);
  const toggle = useToggleFavorite('house', 18);

  return (
    <button
      type="button"
      onClick={() => toggle.mutate(state.isFavorite)}
    >
      {state.isFavorite ? '已收藏' : '未收藏'}
    </button>
  );
}

describe('favorite hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFavorites.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 1,
    });
    mockPutFavorite.mockResolvedValue({
      id: 7,
      target_type: 'house',
      target_id: '18',
      available: true,
      created_at: '2026-07-19T10:00:00+08:00',
      display: { title: '测试房源', subtitle: '测试地址' },
      target: {},
    });
    mockRemoveFavorite.mockResolvedValue({ success: true });
  });

  it('按通用参数查询单目标收藏状态', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <FavoriteHarness />
      </QueryClientProvider>,
    );

    await screen.findByRole('button', { name: '未收藏' });
    expect(mockGetFavorites).toHaveBeenCalledWith({
      target_type: 'house',
      target_id: '18',
      page: 1,
      page_size: 1,
    });
  });

  it('切换收藏后同步单目标缓存并失效列表和类型缓存', async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    render(
      <QueryClientProvider client={queryClient}>
        <FavoriteHarness />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '未收藏' }));

    await screen.findByRole('button', { name: '已收藏' });
    expect(mockPutFavorite).toHaveBeenCalledWith('house', '18');
    expect(
      queryClient.getQueryData(favoriteKeys.target('house', 18)),
    ).toMatchObject({ total: 1 });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: favoriteKeys.lists(),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: favoriteKeys.types(),
    });

    fireEvent.click(screen.getByRole('button', { name: '已收藏' }));
    await waitFor(() =>
      expect(mockRemoveFavorite).toHaveBeenCalledWith('house', '18'),
    );
    await screen.findByRole('button', { name: '未收藏' });
  });
});
