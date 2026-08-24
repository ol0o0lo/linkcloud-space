import { describe, expect, it } from 'vitest';
import {
  HOUSE_STATUS_COLUMN_WIDTH,
  HOUSE_TABLE_PAGINATION_MIN_HEIGHT,
} from './houseListLayout';

describe('房源列表布局约束', () => {
  it('为状态图标和四字状态文本保留单行宽度', () => {
    expect(HOUSE_STATUS_COLUMN_WIDTH).toBeGreaterThanOrEqual(120);
  });

  it('为底部分页保留完整控件高度', () => {
    expect(HOUSE_TABLE_PAGINATION_MIN_HEIGHT).toBeGreaterThanOrEqual(40);
  });
});
