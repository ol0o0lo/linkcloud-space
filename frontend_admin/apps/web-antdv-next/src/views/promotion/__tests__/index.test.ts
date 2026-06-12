import { createApp, defineComponent, nextTick } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMyReferralSummaryApi, listMyReferralRecordsApi } = vi.hoisted(() => ({
  getMyReferralSummaryApi: vi.fn(),
  listMyReferralRecordsApi: vi.fn(),
}));

vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({
    name: 'Page',
    template: '<div><slot /></div>',
  }),
}));

vi.mock('antdv-next', () => ({
  Alert: defineComponent({
    name: 'Alert',
    props: {
      message: String,
    },
    template: '<div>{{ message }}</div>',
  }),
  Button: defineComponent({
    name: 'Button',
    props: {
      block: Boolean,
      disabled: Boolean,
      loading: Boolean,
      type: String,
    },
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
  }),
  Card: defineComponent({
    name: 'Card',
    template: '<section><slot /></section>',
  }),
  Input: defineComponent({
    name: 'Input',
    props: {
      readonly: Boolean,
      value: {
        default: '',
        type: String,
      },
    },
    template: '<input :readonly="readonly" :value="value">',
  }),
  Table: defineComponent({
    name: 'Table',
    props: {
      dataSource: {
        default: () => [],
        type: Array,
      },
    },
    template: '<div></div>',
  }),
  Tag: defineComponent({
    name: 'Tag',
    template: '<span><slot /></span>',
  }),
  message: {
    success: vi.fn(),
  },
}));

vi.mock('#/api/django/referrals', () => ({
  getMyReferralSummaryApi,
  listMyReferralRecordsApi,
}));

import PromotionIndex from '../index.vue';

async function flushPromises() {
  for (const _ of [0, 1, 2, 3]) {
    await Promise.resolve();
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

function findButton(container: HTMLElement, text: string) {
  return [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(text));
}

describe('promotion index page', () => {
  beforeEach(() => {
    getMyReferralSummaryApi.mockReset();
    listMyReferralRecordsApi.mockReset();
  });

  it('进入页面后自动生成并展示分享信息', async () => {
    getMyReferralSummaryApi.mockResolvedValue({
      invite_code: 'ABCD1234',
      pending_review_count: 1,
      registered_count: 2,
      rewarded_count: 1,
      share_link: '/accounts/signup/?invite_code=ABCD1234',
    });
    listMyReferralRecordsApi.mockResolvedValue({
      items: [],
      page: 1,
      page_size: 20,
      total: 0,
    });

    const container = document.createElement('div');
    createApp(PromotionIndex).mount(container);
    await flushPromises();

    expect(getMyReferralSummaryApi).toHaveBeenCalledTimes(1);
    expect(listMyReferralRecordsApi).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('分享 -> 注册 -> 生成邀请记录 -> 完成关键行为 -> 管理员审核 -> 发奖');
    expect(container.textContent).not.toContain('邀请注册');
    expect(container.textContent).not.toContain('我的邀请码');
    expect(container.textContent).toContain('ABCD1234');
    expect(container.textContent).toContain('已邀请');
    expect(container.textContent).toContain('待奖励');
    expect(findButton(container, '复制分享链接')).toBeTruthy();
  });

  it('自动生成过程中展示明确等待提示', async () => {
    getMyReferralSummaryApi.mockReturnValue(new Promise(() => {}));

    const container = document.createElement('div');
    createApp(PromotionIndex).mount(container);
    await nextTick();

    expect(getMyReferralSummaryApi).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('正在生成分享资产');
    expect(container.textContent).toContain('生成完成后会自动展示，无需额外操作。');
    expect(findButton(container, '重新生成推广链接')).toBeFalsy();
  });

  it('生成失败时展示明确错误提示', async () => {
    getMyReferralSummaryApi.mockRejectedValue(new Error('boom'));
    listMyReferralRecordsApi.mockResolvedValue({
      items: [],
      page: 1,
      page_size: 20,
      total: 0,
    });

    const container = document.createElement('div');
    createApp(PromotionIndex).mount(container);
    await flushPromises();

    expect(container.textContent).toContain('推广链接生成失败，请稍后重试。');
    expect(findButton(container, '重新生成推广链接')).toBeTruthy();
  });

  it('邀请记录加载失败时仍保留已生成的推广链接', async () => {
    getMyReferralSummaryApi.mockResolvedValue({
      invite_code: 'EFGH5678',
      pending_review_count: 0,
      registered_count: 0,
      rewarded_count: 0,
      share_link: '/accounts/signup/?invite_code=EFGH5678',
    });
    listMyReferralRecordsApi.mockRejectedValue(new Error('records failed'));

    const container = document.createElement('div');
    createApp(PromotionIndex).mount(container);
    await flushPromises();

    expect(container.textContent).toContain('EFGH5678');
    expect(container.textContent).toContain('邀请记录加载失败，已保留推广链接，你可以先继续分享。');
    expect(container.textContent).not.toContain('推广链接生成失败，请稍后重试。');
  });
});
