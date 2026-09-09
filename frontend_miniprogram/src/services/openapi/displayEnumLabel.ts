/* eslint-disable */
// @ts-ignore
import * as API from './types';

export function displayActionEnum(field: API.ActionEnum) {
  return {
    mark_read: 'mark_read',
    mark_unread: 'mark_unread',
    delete: 'delete',
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

export function displayHouseStatusEnum(field: API.HouseStatus) {
  return {
    vacant: 'vacant',
    listed: 'listed',
    rented: 'rented',
    renovating: 'renovating',
    inactive: 'inactive',
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
  return { manual: 'manual', dynamic: 'dynamic' }[field];
}

export function displayScopeEnum(field: API.ScopeEnum) {
  return {
    platform: 'platform',
    organization: 'organization',
    teams: 'teams',
    users: 'users',
  }[field];
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

export function displayStatusEnum(field: API.StatusEnum) {
  return {
    matched: 'matched',
    overridden: 'overridden',
    ambiguous: 'ambiguous',
    new: 'new',
    created: 'created',
  }[field];
}

export function displayStatusEnum2(field: API.StatusEnum2) {
  return { valid: 'valid', error: 'error', ignored: 'ignored' }[field];
}

export function displayStatusEnum3(field: API.StatusEnum3) {
  return { active: 'active', expired: 'expired', revoked: 'revoked' }[field];
}

export function displayValueSourceEnum(field: API.Value_sourceEnum) {
  return { default: 'default', organization: 'organization', team: 'team' }[
    field
  ];
}

export function displayViewScopeEnum(field: API.View_scopeEnum) {
  return { self: 'self', organization: 'organization' }[field];
}
