const ORG_SLUG_STORAGE_KEY = 'frontend-admin-org-slug';

let selectedOrgSlug: string | undefined;
let orgSelectionRevision = 0;

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
  const nextSlug = normalizeOrgSlug(slug);
  if (nextSlug !== getSelectedOrgSlug()) orgSelectionRevision += 1;
  selectedOrgSlug = nextSlug;

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

export function getOrgSelectionRevision() {
  return orgSelectionRevision;
}

export function resolveSelectedOrgSlug<
  T extends { slug: string; is_current?: boolean },
>(organizations: T[]) {
  const storedSlug = getSelectedOrgSlug();
  if (storedSlug && organizations.some((item) => item.slug === storedSlug)) {
    return storedSlug;
  }

  const currentSlug = organizations.find((item) => item.is_current)?.slug;
  if (currentSlug) {
    return setSelectedOrgSlug(currentSlug);
  }

  if (organizations.length === 1) {
    return setSelectedOrgSlug(organizations[0].slug);
  }

  return setSelectedOrgSlug(undefined);
}
