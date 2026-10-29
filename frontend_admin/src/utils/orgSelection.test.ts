import { beforeEach, describe, expect, it } from 'vitest';
import {
  getOrgSelectionRevision,
  resolveSelectedOrgSlug,
  setSelectedOrgSlug,
} from './orgSelection';

describe('orgSelection', () => {
  beforeEach(() => {
    localStorage.clear();
    setSelectedOrgSlug(undefined);
  });

  it('仅在工作空间选择实际变化时递增版本，切回原组织也保留变化记录', () => {
    const initialRevision = getOrgSelectionRevision();
    setSelectedOrgSlug('tenant-a');
    expect(getOrgSelectionRevision()).toBe(initialRevision + 1);
    setSelectedOrgSlug(' tenant-a ');
    expect(getOrgSelectionRevision()).toBe(initialRevision + 1);
    setSelectedOrgSlug('tenant-c');
    setSelectedOrgSlug('tenant-a');
    expect(getOrgSelectionRevision()).toBe(initialRevision + 3);
    setSelectedOrgSlug(undefined);
    expect(getOrgSelectionRevision()).toBe(initialRevision + 4);
    setSelectedOrgSlug(null);
    expect(getOrgSelectionRevision()).toBe(initialRevision + 4);
  });

  it('defaults to the first org when there is only one option', () => {
    const slug = resolveSelectedOrgSlug([
      {
        id: 1,
        name: 'Acme',
        slug: 'acme',
        isCurrent: false,
        isPrimary: true,
      },
    ]);

    expect(slug).toBe('acme');
    expect(localStorage.getItem('frontend-admin-org-slug')).toBe('acme');
  });

  it('clears the stored selection when it is no longer available', () => {
    setSelectedOrgSlug('missing-org');

    const slug = resolveSelectedOrgSlug([
      {
        id: 2,
        name: 'Beta',
        slug: 'beta',
        isCurrent: false,
        isPrimary: false,
      },
      {
        id: 3,
        name: 'Gamma',
        slug: 'gamma',
        isCurrent: false,
        isPrimary: false,
      },
    ]);

    expect(slug).toBeUndefined();
    expect(localStorage.getItem('frontend-admin-org-slug')).toBeNull();
  });

  it('keeps the stored selection when it still exists in the list', () => {
    setSelectedOrgSlug('beta');

    const slug = resolveSelectedOrgSlug([
      {
        id: 2,
        name: 'Beta',
        slug: 'beta',
        isCurrent: false,
        isPrimary: false,
      },
      {
        id: 3,
        name: 'Gamma',
        slug: 'gamma',
        isCurrent: false,
        isPrimary: false,
      },
    ]);

    expect(slug).toBe('beta');
    expect(localStorage.getItem('frontend-admin-org-slug')).toBe('beta');
  });

  it('falls back to the backend current org when multiple options exist', () => {
    const slug = resolveSelectedOrgSlug([
      {
        id: 2,
        name: 'Beta',
        slug: 'beta',
        is_current: false,
        isPrimary: false,
      },
      {
        id: 3,
        name: 'Gamma',
        slug: 'gamma',
        is_current: true,
        isPrimary: false,
      },
    ]);

    expect(slug).toBe('gamma');
    expect(localStorage.getItem('frontend-admin-org-slug')).toBe('gamma');
  });
});
