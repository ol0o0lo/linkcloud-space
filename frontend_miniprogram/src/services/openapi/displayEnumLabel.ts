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
