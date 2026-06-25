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

export function displayMediaTypeEnum(field: API.Media_typeEnum) {
  return { image: 'image', video: 'video', file: 'file' }[field];
}

export function displayScopeEnum(field: API.ScopeEnum) {
  return { platform: 'platform', organization: 'organization', users: 'users' }[
    field
  ];
}

export function displaySideEnum(field: API.SideEnum) {
  return { front: 'front', back: 'back' }[field];
}

export function displaySideEnum2(field: API.SideEnum2) {
  return { front: 'front', back: 'back' }[field];
}
