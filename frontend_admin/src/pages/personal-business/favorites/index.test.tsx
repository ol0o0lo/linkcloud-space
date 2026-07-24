import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetFavoriteTypes, mockGetFavorites, mockRemoveFavorite } =
  vi.hoisted(() => ({
    mockGetFavoriteTypes: vi.fn(),
    mockGetFavorites: vi.fn(),
    mockRemoveFavorite: vi.fn(),
  }));

vi.mock('@/components/PageContainer', () => ({
  PageContainer: ({ children }: any) => <section>{children}</section>,
}));

vi.mock('@/services/manual/favorites', () => ({
  getFavoriteTypes: mockGetFavoriteTypes,
  getMyFavorites: mockGetFavorites,
  putFavorite: vi.fn(),
  removeFavorite: mockRemoveFavorite,
}));

import FavoritesPage from './index';

describe('我的收藏页面', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRemoveFavorite.mockResolvedValue({ success: true });
    mockGetFavoriteTypes.mockResolvedValue([
      {
        target_type: 'house',
        display_name: '房源',
        order: 10,
        favorite_count: 1,
      },
      {
        target_type: 'building',
        display_name: '楼栋',
        order: 20,
        favorite_count: 0,
      },
      {
        target_type: 'estate',
        display_name: '小区',
        order: 30,
        favorite_count: 0,
      },
    ]);
    mockGetFavorites.mockResolvedValue({
      items: [
        {
          id: 1,
          target_type: 'house',
          target_id: '18',
          available: true,
          created_at: '2026-07-19T10:00:00+08:00',
          display: {
            title: '云岸花园 · 1栋 · 801',
            subtitle: '科技园路 1 号',
          },
          target: {
            id: 18,
            room_number: '801',
            area: '42.00',
            asking_rent: '3200.00',
            bedrooms: 1,
            living_rooms: 0,
            public_description: '近地铁精装单间',
            images: [],
            tags: ['近地铁'],
            effective_tags: ['近地铁'],
            building: {
              id: 3,
              name: '1栋',
              address: '科技园路 1 号',
              estate: {
                id: 2,
                name: '云岸花园',
                display_name: '云岸花园',
                province: '广东',
                city: '深圳',
                district: '南山',
                address: '科技园路',
              },
            },
            publisher: {
              slug: 'publisher-a',
              name: '发布方甲',
              description: '',
            },
          },
        },
      ],
      total: 1,
      page: 1,
      page_size: 12,
    });
  });

  it('展示不依赖租户的房源收藏列表', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <FavoritesPage />
      </QueryClientProvider>,
    );

    expect(
      screen.getByRole('heading', { name: '我的收藏' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText('云岸花园 · 1栋 · 801')).toBeInTheDocument(),
    );
    expect(screen.getByText('单间')).toBeInTheDocument();
    expect(screen.getByText('¥3200.00/月')).toBeInTheDocument();
    expect(screen.getByText('发布方甲')).toBeInTheDocument();
    expect(screen.getByText('2026年7月19日收藏')).toBeInTheDocument();
    expect(mockGetFavorites).toHaveBeenCalledWith({
      target_type: 'house',
      page: 1,
      page_size: 12,
    });
  });

  it('按房源、楼栋和小区类型切换收藏列表', async () => {
    mockGetFavorites.mockImplementation(
      ({ target_type }: { target_type: string }) => {
        if (target_type === 'building') {
          return Promise.resolve({
            items: [
              {
                id: 2,
                target_type: 'building',
                target_id: '3',
                available: true,
                created_at: '2026-07-19T10:00:00+08:00',
                target: {
                  id: 3,
                  name: '1栋',
                  address: '科技园路 1 号',
                  floors: 20,
                  elevator: true,
                  images: [],
                  tags: ['近地铁'],
                  estate: { id: 2, name: '云岸花园', display_name: '云岸花园' },
                  publisher: {
                    slug: 'publisher-a',
                    name: '发布方甲',
                    description: '',
                  },
                },
              },
            ],
            total: 1,
            page: 1,
            page_size: 12,
          });
        }
        if (target_type === 'estate') {
          return Promise.resolve({
            items: [
              {
                id: 3,
                target_type: 'estate',
                target_id: '2',
                available: true,
                created_at: '2026-07-19T10:00:00+08:00',
                target: {
                  id: 2,
                  name: '云岸花园',
                  display_name: '云岸花园',
                  province: '广东',
                  city: '深圳',
                  district: '南山',
                  address: '科技园路',
                  images: [],
                  description: '成熟社区',
                  publisher: {
                    slug: 'publisher-a',
                    name: '发布方甲',
                    description: '',
                  },
                },
              },
            ],
            total: 1,
            page: 1,
            page_size: 12,
          });
        }
        return Promise.resolve({ items: [], total: 0, page: 1, page_size: 12 });
      },
    );

    render(
      <QueryClientProvider client={new QueryClient()}>
        <FavoritesPage />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: '楼栋' }));
    await waitFor(() =>
      expect(screen.getByText('云岸花园 · 1栋')).toBeInTheDocument(),
    );
    expect(mockGetFavorites).toHaveBeenCalledWith({
      target_type: 'building',
      page: 1,
      page_size: 12,
    });

    fireEvent.click(screen.getByRole('tab', { name: '小区' }));
    await waitFor(() =>
      expect(screen.getByText('成熟社区')).toBeInTheDocument(),
    );
    expect(mockGetFavorites).toHaveBeenCalledWith({
      target_type: 'estate',
      page: 1,
      page_size: 12,
    });
  });

  it('根据后端类型动态生成 Tab，并用通用摘要展示未知业务', async () => {
    mockGetFavoriteTypes.mockResolvedValue([
      {
        target_type: 'article',
        display_name: '文章',
        order: 5,
        favorite_count: 1,
      },
    ]);
    mockGetFavorites.mockResolvedValue({
      items: [
        {
          id: 8,
          target_type: 'article',
          target_id: 'guide-2026',
          available: true,
          created_at: '2026-07-19T10:00:00+08:00',
          display: {
            title: '第一次租房指南',
            subtitle: '从看房到签约的完整清单',
            description: '帮助普通租客避开常见问题。',
            tags: ['租房攻略'],
            facts: [{ label: '阅读时长', value: '8 分钟' }],
          },
          target: { id: 'guide-2026', author: '链云编辑部' },
        },
      ],
      total: 1,
      page: 1,
      page_size: 12,
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <FavoritesPage />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole('tab', { name: '文章' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '房源' })).not.toBeInTheDocument();
    expect(await screen.findByText('第一次租房指南')).toBeInTheDocument();
    expect(screen.getByText('从看房到签约的完整清单')).toBeInTheDocument();
    expect(screen.getByText('帮助普通租客避开常见问题。')).toBeInTheDocument();
    expect(screen.getByText('8 分钟')).toBeInTheDocument();
    expect(screen.getByText('租房攻略')).toBeInTheDocument();
    expect(mockGetFavorites).toHaveBeenCalledWith({
      target_type: 'article',
      page: 1,
      page_size: 12,
    });
  });

  it('点击红心并确认后取消房源收藏', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <FavoritesPage />
      </QueryClientProvider>,
    );

    await screen.findByText('云岸花园 · 1栋 · 801');
    fireEvent.click(screen.getByRole('button', { name: /取消收藏/ }));
    fireEvent.click(await screen.findByRole('button', { name: /确认取消/ }));

    await waitFor(() =>
      expect(mockRemoveFavorite).toHaveBeenCalledWith('house', '18'),
    );
  });

  it('下架收藏保留说明且仍可取消收藏', async () => {
    mockGetFavorites.mockResolvedValue({
      items: [
        {
          id: 9,
          target_type: 'house',
          target_id: '99',
          available: false,
          created_at: '2026-07-19T10:00:00+08:00',
          target: null,
        },
      ],
      total: 1,
      page: 1,
      page_size: 12,
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <FavoritesPage />
      </QueryClientProvider>,
    );

    expect((await screen.findAllByText('已下架')).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/该目标当前不再公开，收藏关系仍为你保留/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /取消收藏/ }));
    fireEvent.click(await screen.findByRole('button', { name: /确认取消/ }));

    await waitFor(() =>
      expect(mockRemoveFavorite).toHaveBeenCalledWith('house', '99'),
    );
  });
});
