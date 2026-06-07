import { createApp, defineComponent, nextTick } from 'vue';

import { describe, expect, it, vi } from 'vitest';

vi.mock('antdv-next', () => ({
  Button: defineComponent({
    name: 'Button',
    props: {
      disabled: Boolean,
      type: String,
    },
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
  }),
  Card: defineComponent({
    name: 'Card',
    template: '<section><slot /></section>',
  }),
  Tag: defineComponent({
    name: 'Tag',
    template: '<span><slot /></span>',
  }),
}));

import ProfileOverview from '../overview.vue';

function findButton(container: HTMLElement, text: string) {
  return [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(text));
}

describe('overview.vue', () => {
  it('把状态卡和锚点点击统一抛给父层', async () => {
    const container = document.createElement('div');
    const sections: string[] = [];

    createApp(ProfileOverview, {
      cards: [
        {
          actionLabel: '完善资料',
          description: 'desc',
          key: 'basic',
          summary: 'summary',
          tags: ['tag'],
          title: '资料完整度',
          tone: 'warning',
        },
      ],
      hero: {
        completionText: '资料完整度 3/5',
        currentOrgLabel: 'LinkCloud Space',
        displayName: 'Lan Kong',
        email: 'lan@example.com',
        phone: '13800000000',
        phoneVerified: true,
        timezone: 'Asia/Shanghai',
        username: 'lan',
      },
      onOpenSection: (section: string) => {
        sections.push(section);
      },
    }).mount(container);

    await nextTick();
    findButton(container, '完善资料')?.click();
    findButton(container, '安全')?.click();

    expect(sections).toEqual(['basic', 'security']);
  });
});
