// @vitest-environment happy-dom

import { createApp, defineComponent, nextTick } from 'vue';

import { describe, expect, it, vi } from 'vitest';

vi.mock('antdv-next', () => ({
  Avatar: defineComponent({
    name: 'Avatar',
    template: '<div><slot /></div>',
  }),
  Button: defineComponent({
    name: 'Button',
    props: {
      disabled: Boolean,
      type: String,
    },
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
  }),
}));

import ProfileOverview from '../overview.vue';

function findButton(container: HTMLElement, text: string) {
  return [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(text));
}

describe('overview.vue', () => {
  it('展示账户总览并把三个独立入口抛给父层', async () => {
    const container = document.createElement('div');
    const sections: string[] = [];

    createApp(ProfileOverview, {
      avatarText: 'L',
      hasTotp: true,
      unreadCount: 2,
      user: {
        avatar_url: 'https://example.com/avatar.png',
        email: 'lan@example.com',
        first_name: 'Lan',
        last_name: 'Kong',
        phone: '13800000000',
        phone_verified: true,
        real_name_status: 'verified',
        timezone: 'Asia/Shanghai',
        username: 'lan',
      },
      onOpenSection: (section: string) => {
        sections.push(section);
      },
    }).mount(container);

    await nextTick();

    expect(container.textContent).toContain('账户总览');
    expect(container.textContent).toContain('相关设置');

    findButton(container, '进入安全设置')?.click();
    findButton(container, '进入密码页')?.click();
    findButton(container, '进入通知设置')?.click();

    expect(sections).toEqual(['security', 'password', 'notifications']);
  });
});
