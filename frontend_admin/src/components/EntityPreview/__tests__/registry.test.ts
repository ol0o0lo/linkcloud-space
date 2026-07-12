import { describe, expect, it } from 'vitest';
import { entityPreviewRegistry } from '../registry';

describe('entityPreviewRegistry', () => {
  it('非房源实体默认跳转到只读详情而非编辑抽屉', () => {
    expect(entityPreviewRegistry.estate!.getHref(3)).toBe(
      '/property-rental/estates?preview_estate=3',
    );
    expect(entityPreviewRegistry.building!.getHref(5)).toBe(
      '/property-rental/estates?view=buildings&preview_building=5',
    );
    expect(entityPreviewRegistry.contact!.getHref(7)).toBe(
      '/property-rental/contacts?preview=7',
    );
    expect(entityPreviewRegistry.lease!.getHref(11)).toBe(
      '/property-rental/leases?preview=11',
    );
    expect(entityPreviewRegistry.viewing!.getHref(13)).toBe(
      '/property-rental/viewings?preview=13',
    );
  });
});
