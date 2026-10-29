/* eslint-disable */
// @ts-ignore
import * as API from './types';

export function displayAccessKindEnum(field: API.Access_kindEnum) {
  return {
    organization_member: 'organization_member',
    business_party: 'business_party',
  }[field];
}

export function displayActionEnum(field: API.ActionEnum) {
  return {
    mark_read: 'mark_read',
    mark_unread: 'mark_unread',
    delete: 'delete',
  }[field];
}

export function displayCategoryEnum(field: API.CategoryEnum) {
  return {
    区域: '区域',
    商圈: '商圈',
    小区: '小区',
    楼栋: '楼栋',
    房号: '房号',
  }[field];
}

export function displayDecisionEnum(field: API.DecisionEnum) {
  return { approve: 'approve', reject: 'reject' }[field];
}

export function displayEntryTypeEnum(field: API.Entry_typeEnum) {
  return {
    manual_increase: 'manual_increase',
    manual_decrease: 'manual_decrease',
  }[field];
}

export function displayHouseListingTypeEnum(field: API.HouseListingType) {
  return {
    whole: 'whole',
    shared: 'shared',
    apartment: 'apartment',
    short_term: 'short_term',
  }[field];
}

export function displayHouseStatusEnum(field: API.HouseStatus) {
  return { listed: 'listed', rented: 'rented', paused: 'paused' }[field];
}

export function displayKindEnum(field: API.KindEnum) {
  return { walk: 'walk', metro: 'metro' }[field];
}

export function displayLevelEnum(field: API.LevelEnum) {
  return {
    city: 'city',
    district: 'district',
    estate: 'estate',
    building: 'building',
  }[field];
}

export function displayLevelEnum2(field: API.LevelEnum2) {
  return {
    city: 'city',
    district: 'district',
    estate: 'estate',
    building: 'building',
  }[field];
}

export function displayLocationSourceEnum(field: API.Location_sourceEnum) {
  return { estate: 'estate', building_centroid: 'building_centroid' }[field];
}

export function displayMediaTypeEnum(field: API.Media_typeEnum) {
  return { image: 'image', video: 'video', file: 'file' }[field];
}

export function displayModeEnum(field: API.ModeEnum) {
  return { preview: 'preview', apply: 'apply' }[field];
}

export function displayModeEnum2(field: API.ModeEnum2) {
  return { preview: 'preview', apply: 'apply' }[field];
}

export function displayModeEnum3(field: API.ModeEnum3) {
  return { initial: 'initial', resubmit: 'resubmit', correction: 'correction' }[
    field
  ];
}

export function displayModeEnum4(field: API.ModeEnum4) {
  return { initial: 'initial', correction: 'correction' }[field];
}

export function displayModeEnum5(field: API.ModeEnum5) {
  return { manual: 'manual', dynamic: 'dynamic' }[field];
}

export function displayModeEnum6(field: API.ModeEnum6) {
  return {
    metro: 'metro',
    ebike: 'ebike',
    bicycle: 'bicycle',
    walking: 'walking',
    driving: 'driving',
  }[field];
}

export function displayModeEnum7(field: API.ModeEnum7) {
  return {
    metro: 'metro',
    ebike: 'ebike',
    bicycle: 'bicycle',
    walking: 'walking',
    driving: 'driving',
  }[field];
}

export function displayModeEnum8(field: API.ModeEnum8) {
  return {
    metro: 'metro',
    ebike: 'ebike',
    bicycle: 'bicycle',
    walking: 'walking',
    driving: 'driving',
  }[field];
}

export function displayProviderEnum(field: API.ProviderEnum) {
  return { amap: 'amap', qweather: 'qweather' }[field];
}

export function displayScopeEnum(field: API.ScopeEnum) {
  return {
    platform: 'platform',
    organization: 'organization',
    teams: 'teams',
    users: 'users',
  }[field];
}

export function displayScopeEnum2(field: API.ScopeEnum2) {
  return { personal: 'personal', organization: 'organization' }[field];
}

export function displaySideEnum(field: API.SideEnum) {
  return { front: 'front', back: 'back' }[field];
}

export function displaySideEnum2(field: API.SideEnum2) {
  return { front: 'front', back: 'back' }[field];
}

export function displaySortEnum(field: API.SortEnum) {
  return {
    latest: 'latest',
    rent_asc: 'rent_asc',
    rent_desc: 'rent_desc',
    area_asc: 'area_asc',
    area_desc: 'area_desc',
  }[field];
}

export function displaySourceEnum(field: API.SourceEnum) {
  return { device: 'device', default: 'default' }[field];
}

export function displayStateEnum(field: API.StateEnum) {
  return { not_generated: 'not_generated', fresh: 'fresh', expired: 'expired' }[
    field
  ];
}

export function displayStatusEnum(field: API.StatusEnum) {
  return { active: 'active', closed: 'closed' }[field];
}

export function displayStatusEnum2(field: API.StatusEnum2) {
  return {
    matched: 'matched',
    overridden: 'overridden',
    ambiguous: 'ambiguous',
    new: 'new',
    created: 'created',
  }[field];
}

export function displayStatusEnum3(field: API.StatusEnum3) {
  return { valid: 'valid', error: 'error', ignored: 'ignored' }[field];
}

export function displayStatusEnum4(field: API.StatusEnum4) {
  return { new: 'new', processing: 'processing', closed: 'closed' }[field];
}

export function displayStatusEnum5(field: API.StatusEnum5) {
  return { active: 'active', expired: 'expired', revoked: 'revoked' }[field];
}

export function displayStatusEnum6(field: API.StatusEnum6) {
  return { pending: 'pending', ready: 'ready', failed: 'failed' }[field];
}

export function displayToneEnum(field: API.ToneEnum) {
  return { positive: 'positive', neutral: 'neutral', caution: 'caution' }[
    field
  ];
}

export function displayValueSourceEnum(field: API.Value_sourceEnum) {
  return { default: 'default', organization: 'organization', team: 'team' }[
    field
  ];
}

export function displayViewScopeEnum(field: API.View_scopeEnum) {
  return { self: 'self', organization: 'organization' }[field];
}
