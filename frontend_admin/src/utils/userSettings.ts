const INTERNAL_USER_SETTING_PREFIX = 'internal.';

export const isEditableUserSettingKey = (key: string) =>
  !key.startsWith(INTERNAL_USER_SETTING_PREFIX);

export const visibleUserSettings = <T extends { key: string }>(items: T[]) =>
  items.filter((item) => isEditableUserSettingKey(item.key));
