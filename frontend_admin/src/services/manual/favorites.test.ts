import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock('@umijs/max', () => ({ request: mockRequest }));

import {
  getFavoriteTypes,
  getMyFavorites,
  putFavorite,
  removeFavorite,
} from './favorites';

describe('favorites client', () => {
  beforeEach(() => {
    mockRequest.mockReset();
    mockRequest.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 12 });
  });

  it('读取当前用户的通用收藏', async () => {
    await getMyFavorites({ page: 2, page_size: 12 });

    expect(mockRequest).toHaveBeenCalledWith('/api/users/me/favorite/', {
      method: 'GET',
      params: { page: 2, page_size: 12 },
    });
  });

  it('读取后端注册的收藏目标类型', async () => {
    await getFavoriteTypes();

    expect(mockRequest).toHaveBeenCalledWith(
      '/api/users/me/favorite/type/',
      { method: 'GET' },
    );
  });

  it('通过通用接口收藏和取消目标', async () => {
    await putFavorite('house', '18');
    await removeFavorite('house', '18');

    expect(mockRequest).toHaveBeenNthCalledWith(
      1,
      '/api/users/me/favorite/',
      {
        method: 'PUT',
        params: { target_type: 'house', target_id: '18' },
      },
    );
    expect(mockRequest).toHaveBeenCalledWith(
      '/api/users/me/favorite/',
      {
        method: 'DELETE',
        params: { target_type: 'house', target_id: '18' },
      },
    );
  });

  it('通过通用列表接口筛选单个收藏目标', async () => {
    await getMyFavorites({
      target_type: 'house',
      target_id: 18,
      page: 1,
      page_size: 1,
    });

    expect(mockRequest).toHaveBeenCalledWith('/api/users/me/favorite/', {
      method: 'GET',
      params: {
        target_type: 'house',
        target_id: 18,
        page: 1,
        page_size: 1,
      },
    });
  });
});
