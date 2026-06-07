import type { BasicUserInfo } from '@vben/types';

import type { AuthenticatorRow, SocialAccountRow } from '#/api/django/auth';
import type { NotificationPreferenceRow, UserRow } from '#/api/django/resources';

export type ProfileSectionKey = 'basic' | 'notification' | 'password' | 'security';

export interface ProfileHeroModel {
  completionText: string;
  currentOrgLabel: string;
  displayName: string;
  email: string;
  phone: string;
  phoneVerified: boolean;
  timezone: string;
  username: string;
}

export interface ProfileStatusCard {
  actionLabel: string;
  description: string;
  key: ProfileSectionKey;
  summary: string;
  tags: string[];
  tone: 'default' | 'positive' | 'warning';
  title: string;
}

export function buildProfileHero(
  user: null | UserRow,
  userInfo: BasicUserInfo | null,
  currentOrgLabel: string,
): ProfileHeroModel {
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || userInfo?.realName || user?.email || user?.username || '当前用户';
  const completedFields = [user?.avatar_url, displayName, user?.email, user?.phone, user?.timezone].filter(Boolean).length;

  return {
    completionText: `资料完整度 ${completedFields}/5`,
    currentOrgLabel: currentOrgLabel || '当前暂无组织上下文',
    displayName,
    email: user?.email || '未设置邮箱',
    phone: user?.phone || '未绑定手机号',
    phoneVerified: Boolean(user?.phone_verified),
    timezone: user?.timezone || 'Asia/Shanghai',
    username: user?.username || userInfo?.username || 'account',
  };
}

export function buildProfileStatusCards(input: {
  authenticators: AuthenticatorRow[];
  notificationPreferences: NotificationPreferenceRow[];
  socialAccounts: SocialAccountRow[];
  user: null | UserRow;
}): ProfileStatusCard[] {
  const passkeyCount = input.authenticators.filter((item) => item.type === 'webauthn').length;
  const hasTotp = input.authenticators.some((item) => item.type === 'totp');
  const inAppEnabled = input.notificationPreferences.filter((item) => item.in_app).length;
  const emailEnabled = input.notificationPreferences.filter((item) => item.email).length;

  return [
    {
      actionLabel: '完善资料',
      description: '补齐头像、姓名、手机号和时区，让身份信息更完整。',
      key: 'basic',
      summary: input.user?.avatar_url ? '资料已基本完善' : '还可补充头像与资料细节',
      tags: [input.user?.email || '未设置邮箱', input.user?.phone || '未绑定手机号'],
      tone: input.user?.avatar_url ? 'positive' : 'warning',
      title: '资料完整度',
    },
    {
      actionLabel: '提升安全',
      description: '集中处理验证器、Passkey、第三方绑定和登录密码。',
      key: 'security',
      summary: hasTotp ? (passkeyCount > 0 ? `已开启验证器，已添加 ${passkeyCount} 个 Passkey` : '已开启验证器，尚未添加 Passkey') : '尚未开启验证器',
      tags: [hasTotp ? '验证器已开启' : '验证器未开启', `${passkeyCount} 个 Passkey`, `${input.socialAccounts.length} 个第三方绑定`],
      tone: hasTotp ? (passkeyCount > 0 ? 'positive' : 'warning') : 'warning',
      title: '账户安全',
    },
    {
      actionLabel: '管理提醒',
      description: '按分类控制站内信和邮件提醒触达方式。',
      key: 'notification',
      summary: `站内信开启 ${inAppEnabled} 项，邮件开启 ${emailEnabled} 项`,
      tags: [`${input.notificationPreferences.length} 个分类`, `${inAppEnabled} 项站内信`, `${emailEnabled} 项邮件`],
      tone: emailEnabled + inAppEnabled > 0 ? 'positive' : 'warning',
      title: '消息提醒',
    },
  ];
}
