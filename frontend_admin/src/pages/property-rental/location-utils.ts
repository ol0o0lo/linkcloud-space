import type { LocationValue } from '@/components/LocationPicker';

export function formLocation(values: { address?: string; lat?: unknown; lng?: unknown }): LocationValue | null {
  if (!values.address || values.lat == null || values.lng == null) return null;
  const lat = Number(values.lat);
  const lng = Number(values.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { address: values.address, lat, lng } : null;
}

export function settingLocation(value: unknown): LocationValue | null {
  return value && typeof value === 'object' ? formLocation(value as { address?: string; lat?: unknown; lng?: unknown }) : null;
}
