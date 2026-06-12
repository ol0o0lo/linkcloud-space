import { shallowMount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';

import Profile from '../profile.vue';

const PageStub = defineComponent({
  name: 'Page',
  template: '<div data-test="page"><slot /></div>',
});

function renderProfile() {
  return shallowMount(Profile, {
    props: {
      title: '个人中心',
      userInfo: {
        avatar: '',
        realName: 'Lan',
        username: 'lan',
      },
    },
    slots: {
      content: '<div>内容区域</div>',
    },
    global: {
      stubs: {
        Page: PageStub,
      },
    },
  });
}

describe('profile.vue', () => {
  it('渲染账户头部和内容区域', () => {
    const wrapper = renderProfile();

    expect(wrapper.text()).toContain('个人中心');
    expect(wrapper.text()).toContain('账户中心');
    expect(wrapper.text()).toContain('Lan');
    expect(wrapper.text()).toContain('@lan');
    expect(wrapper.text()).toContain('内容区域');
  });
});
