import { describe, expect, it } from 'vitest';

import { buildProfileHero, buildProfileStatusCards } from '../profile-dashboard';

describe('profile-dashboard', () => {
  it('根据用户资料生成身份主舞台信息', () => {
    const hero = buildProfileHero(
      {
        avatar_url: 'https://example.com/avatar.png',
        email: 'lan@example.com',
        first_name: 'Lan',
        id: 1,
        last_name: 'Kong',
        phone: '13800000000',
        phone_verified: true,
        timezone: 'Asia/Shanghai',
        username: 'lan',
      },
      {
        avatar: 'https://example.com/avatar.png',
        realName: 'Lan Kong',
        userId: '1',
        username: 'lan',
      },
      'LinkCloud Space',
    );

    expect(hero.displayName).toBe('Lan Kong');
    expect(hero.currentOrgLabel).toBe('LinkCloud Space');
    expect(hero.completionText).toContain('资料完整度');
  });

  it('在未添加 passkey 时给出安全警告摘要', () => {
    const cards = buildProfileStatusCards({
      authenticators: [{ type: 'totp' }],
      notificationPreferences: [],
      socialAccounts: [],
      user: { email: 'lan@example.com', id: 1, username: 'lan' },
    });

    const security = cards.find((item) => item.key === 'security');
    expect(security?.tone).toBe('warning');
    expect(security?.summary).toContain('尚未添加 Passkey');
  });

  it('正确汇总通知渠道开启数量', () => {
    const cards = buildProfileStatusCards({
      authenticators: [],
      notificationPreferences: [
        { description: '', email: true, in_app: false, key: 'invite', label: '邀请' },
        { description: '', email: true, in_app: true, key: 'system', label: '系统' },
      ],
      socialAccounts: [],
      user: { email: 'lan@example.com', id: 1, username: 'lan' },
    });

    const notification = cards.find((item) => item.key === 'notification');
    expect(notification?.summary).toBe('站内信开启 1 项，邮件开启 2 项');
  });
});
