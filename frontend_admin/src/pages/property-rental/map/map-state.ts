export function readMapSearchState(search: string) {
  const params = new URLSearchParams(search);
  const number = (key: string) => {
    const value = Number(params.get(key));
    return Number.isFinite(value) ? value : undefined;
  };
  const estateId = number('estate_id');
  const selectedBuildingId = number('selected_building_id');
  return {
    keyword: params.get('keyword') || '',
    estateId: estateId && estateId > 0 ? estateId : undefined,
    houseStatus: params.get('house_status') || undefined,
    includeInactive: params.get('include_inactive') === 'true',
    selectedBuildingId: selectedBuildingId && selectedBuildingId > 0 ? selectedBuildingId : undefined,
  };
}
