export type TagType = {
  key: string;
  label: string;
};

export type GeographicItemType = {
  name: string;
  id: string;
};

export type NoticeType = {
  id: string;
  title: string;
  logo: string;
  description: string;
  updatedAt: string;
  member: string;
  href: string;
  memberLink: string;
};

export type CurrentUser = API.MeOut;

export type SocialBindingProvider = 'github' | 'weixin';

export type SocialBindingItem = {
  provider: SocialBindingProvider;
  label: string;
  connected: boolean;
};
