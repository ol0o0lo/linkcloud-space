import type { LocationValue } from '@/components/LocationPicker';

type ApiLocation = {
  latitude?: unknown;
  longitude?: unknown;
};

type LocationSource = {
  address?: string;
  lat?: unknown;
  lng?: unknown;
  location?: ApiLocation | null;
};

export function formLocation(values: LocationSource): LocationValue | null {
  const latitude = values.lat ?? values.location?.latitude;
  const longitude = values.lng ?? values.location?.longitude;
  if (!values.address || latitude == null || longitude == null) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { address: values.address, lat, lng } : null;
}

export function locationFormValues<T extends LocationSource>(values: T): T & { lat: number | null; lng: number | null } {
  const location = formLocation(values);
  return { ...values, lat: location?.lat ?? null, lng: location?.lng ?? null };
}

export function withApiLocation<T extends LocationSource>(values: T) {
  const { lat, lng, ...payload } = values;
  const latitude = lat == null || lat === '' ? null : Number(lat);
  const longitude = lng == null || lng === '' ? null : Number(lng);
  return {
    ...payload,
    location:
      latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)
        ? { latitude, longitude, coordinate_system: 'gcj02' as const }
        : null,
  };
}

export function settingLocation(value: unknown): LocationValue | null {
  return value && typeof value === 'object' ? formLocation(value as { address?: string; lat?: unknown; lng?: unknown }) : null;
}

export function prefillBuildingLocation(address: string | undefined, location: LocationValue): Partial<LocationValue> {
  return address?.trim() ? { lat: location.lat, lng: location.lng } : location;
}
