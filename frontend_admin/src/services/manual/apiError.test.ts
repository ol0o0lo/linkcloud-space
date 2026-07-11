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
});
