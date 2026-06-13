import { beforeEach, describe, expect, it } from 'vitest';
import { resolveSelectedOrgSlug, setSelectedOrgSlug } from './orgSelection';

describe('orgSelection', () => {
  beforeEach(() => {
    localStorage.clear();
    setSelectedOrgSlug(undefined);
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
});
