import { describe, expect, it } from 'vitest';

import { unwrapWalletResponse } from '../wallet-response';

describe('wallet api helpers', () => {
  it('遇到钱包业务错误包时抛出 detail', () => {
    expect(() => unwrapWalletResponse({ code: '013003', detail: '微信提现配置缺失' })).toThrowError('微信提现配置缺失');
  });

  it('正常响应直接返回原始数据', () => {
    const payload = { items: [], total: 0, page: 1, page_size: 10 };
    expect(unwrapWalletResponse(payload)).toEqual(payload);
  });
});
