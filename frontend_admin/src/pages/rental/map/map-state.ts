import { HOUSE_STATUS } from '../constants';

export function readMapSearchState(search: string) {
  const params = new URLSearchParams(search);
  const number = (key: string) => {
    const rawValue = params.get(key);
    if (rawValue == null || rawValue.trim() === '') return undefined;

    const value = Number(rawValue);
    return Number.isFinite(value) ? value : undefined;
  };
  const estateId = number('estate_id');
  const selectedBuildingId = number('selected_building_id');
  const centerLat = number('center_lat');
  const centerLng = number('center_lng');
  const zoom = number('zoom');
  return {
    keyword: params.get('keyword') || '',
    estateId: estateId && estateId > 0 ? estateId : undefined,
    houseStatus: params.get('house_status') || HOUSE_STATUS.VACANT,
    selectedBuildingId:
      selectedBuildingId && selectedBuildingId > 0
        ? selectedBuildingId
        : undefined,
    viewport:
      centerLat != null &&
      centerLng != null &&
      centerLat >= -90 &&
      centerLat <= 90 &&
      centerLng >= -180 &&
      centerLng <= 180 &&
      zoom != null &&
      zoom >= 2 &&
      zoom <= 20
        ? { lat: centerLat, lng: centerLng, zoom }
        : undefined,
  };
}

export function sameBounds(
  left?: { west: number; south: number; east: number; north: number },
  right?: { west: number; south: number; east: number; north: number },
) {
  if (!left || !right) return left === right;
  return (['west', 'south', 'east', 'north'] as const).every(
    (key) => Math.abs(left[key] - right[key]) < 0.00001,
  );
}
