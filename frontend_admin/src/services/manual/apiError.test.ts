import { describe, expect, it } from 'vitest';

import { getResourceInUseData } from './apiError';

describe('getResourceInUseData', () => {
  const data: API.DeleteCheckOut = {
    can_delete: false,
    resources: [],
  };

  it('提取 Umi BizError 中的资源占用详情', () => {
    expect(getResourceInUseData({ info: { error: 'RESOURCE_IN_USE', data } })).toBe(data);
  });

  it('提取 HTTP 响应中的资源占用详情', () => {
    expect(getResourceInUseData({ response: { data: { error: 'RESOURCE_IN_USE', data } } })).toBe(data);
  });

  it('忽略非资源占用错误', () => {
    expect(getResourceInUseData({ info: { error: 'VALIDATION_ERROR', data } })).toBeUndefined();
  });

  it('忽略缺失资源占用详情的错误', () => {
    expect(getResourceInUseData({ info: { error: 'RESOURCE_IN_USE', data: null } })).toBeUndefined();
  });

  it('忽略缺失可删除标记的资源占用错误', () => {
    expect(getResourceInUseData({ info: { error: 'RESOURCE_IN_USE', data: { resources: [] } } })).toBeUndefined();
  });

  it('忽略资源列表不是数组的资源占用错误', () => {
    expect(getResourceInUseData({ info: { error: 'RESOURCE_IN_USE', data: { can_delete: false, resources: {} } } })).toBeUndefined();
  });

  it('忽略包含空资源项的资源占用错误', () => {
    expect(getResourceInUseData({ info: { error: 'RESOURCE_IN_USE', data: { can_delete: false, resources: [null] } } })).toBeUndefined();
  });

  it('忽略目标信息错误的资源占用错误', () => {
    expect(
      getResourceInUseData({
        info: {
          error: 'RESOURCE_IN_USE',
          data: { can_delete: false, resources: [{ type: 'house', label: '房源', count: 1, items: [], truncated: false, target: { path: 1, query: {} } }] },
        },
      }),
    ).toBeUndefined();
  });

  it('忽略目标查询参数为数组的资源占用错误', () => {
    expect(
      getResourceInUseData({
        info: {
          error: 'RESOURCE_IN_USE',
          data: { can_delete: false, resources: [{ type: 'house', label: '房源', count: 1, items: [], truncated: false, target: { path: '/houses', query: [] } }] },
        },
      }),
    ).toBeUndefined();
  });

  it('忽略资源项 ID 错误的资源占用错误', () => {
    expect(
      getResourceInUseData({
        info: {
          error: 'RESOURCE_IN_USE',
          data: {
            can_delete: false,
            resources: [{ type: 'house', label: '房源', count: 1, items: [{ id: '1', label: 'A-101' }], truncated: false, target: { path: '/houses', query: {} } }],
          },
        },
      }),
    ).toBeUndefined();
  });
});
