import { describe, expect, it } from 'vitest';
import { entityPreviewRegistry } from '../registry';

describe('entityPreviewRegistry', () => {
  it('按实体类型声明悬浮卡宽度', () => {
    expect(entityPreviewRegistry.estate?.popoverWidth).toBe(460);
    expect(entityPreviewRegistry.building?.popoverWidth).toBe(460);
    expect(entityPreviewRegistry.house?.popoverWidth).toBe(460);
    expect(entityPreviewRegistry.contact?.popoverWidth).toBe(390);
    expect(entityPreviewRegistry.lease?.popoverWidth).toBe(390);
    expect(entityPreviewRegistry.viewing?.popoverWidth).toBe(390);
  });

  it('按实体类型声明加载骨架是否包含媒体区', () => {
    expect(entityPreviewRegistry.estate?.popoverMedia).toBe(true);
    expect(entityPreviewRegistry.building?.popoverMedia).toBe(true);
    expect(entityPreviewRegistry.house?.popoverMedia).toBe(true);
    expect(entityPreviewRegistry.contact?.popoverMedia).toBe(false);
    expect(entityPreviewRegistry.lease?.popoverMedia).toBe(false);
    expect(entityPreviewRegistry.viewing?.popoverMedia).toBe(false);
  });

  it('非房源实体默认跳转到只读详情而非编辑抽屉', () => {
    expect(entityPreviewRegistry.estate?.getHref(3)).toBe(
      '/rental/properties/estates?preview_estate=3',
    );
    expect(entityPreviewRegistry.building?.getHref(5)).toBe(
      '/rental/properties/estates?view=buildings&preview_building=5',
    );
    expect(entityPreviewRegistry.contact?.getHref(7)).toBe(
      '/rental/customers?preview=7',
    );
    expect(entityPreviewRegistry.lease?.getHref(11)).toBe(
      '/rental/leases?preview=11',
    );
    expect(entityPreviewRegistry.viewing?.getHref(13)).toBe(
      '/rental/viewings?preview=13',
    );
  });
});
