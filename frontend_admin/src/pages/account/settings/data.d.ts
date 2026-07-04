export type CurrentUser = API.MeOut;

export type SocialBindingProvider = 'github' | 'weixin';

export type SocialBindingItem = {
  provider: SocialBindingProvider;
  label: string;
  connected: boolean;
};
