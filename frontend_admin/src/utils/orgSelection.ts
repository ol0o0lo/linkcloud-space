const ORG_SLUG_STORAGE_KEY = 'frontend-admin-org-slug';

let selectedOrgSlug: string | undefined;

function getStorage() {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return window.localStorage;
}

function normalizeOrgSlug(slug?: string | null) {
  const value = slug?.trim();
  return value ? value : undefined;
}

export function getSelectedOrgSlug() {
  if (selectedOrgSlug !== undefined) {
    return selectedOrgSlug;
  }

  const storage = getStorage();
  selectedOrgSlug = normalizeOrgSlug(storage?.getItem(ORG_SLUG_STORAGE_KEY));
  return selectedOrgSlug;
}

export function setSelectedOrgSlug(slug?: string | null) {
  selectedOrgSlug = normalizeOrgSlug(slug);

  const storage = getStorage();
  if (!storage) {
    return selectedOrgSlug;
  }

  if (selectedOrgSlug) {
    storage.setItem(ORG_SLUG_STORAGE_KEY, selectedOrgSlug);
  } else {
    storage.removeItem(ORG_SLUG_STORAGE_KEY);
  }

  return selectedOrgSlug;
}

export function resolveSelectedOrgSlug<T extends { slug: string }>(
  organizations: T[],
) {
  const storedSlug = getSelectedOrgSlug();
  if (storedSlug && organizations.some((item) => item.slug === storedSlug)) {
    return storedSlug;
  }

  if (organizations.length === 1) {
    return setSelectedOrgSlug(organizations[0].slug);
  }

  return setSelectedOrgSlug(undefined);
}
