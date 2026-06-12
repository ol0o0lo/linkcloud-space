<script setup>
import { computed, inject, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import {
  BellIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  ChevronRightIcon,
  CreditCardIcon,
  EnvelopeIcon,
  KeyIcon,
  LockClosedIcon,
  PencilSquareIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from '@heroicons/vue/24/outline';

import AccountLayout from '@/layouts/AccountLayout.vue';
import AvatarCropper from '@/components/AvatarCropper.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { showToast } from '@/composables/useToast';
import TimezoneSelectApp from '@/apps/TimezoneSelectApp.vue';
import { get, patch, parseErrors } from '@/utils/api';
import { getTimezoneLabel } from '@/utils/timezones';
import FormErrors from '../components/FormErrors.vue';
import { authApi } from '../api';

const appStore = inject('appStore');

const editing = ref(false);
const loading = ref(false);
const metaLoading = ref(false);
const errors = ref({});

const firstName = ref(appStore.user?.first_name || '');
const lastName = ref(appStore.user?.last_name || '');
const timezone = ref(appStore.user?.timezone || '');

const emails = ref([]);
const authenticators = ref([]);
const notificationPrefs = ref([]);
const socialAccounts = ref([]);

function resetForm() {
  firstName.value = appStore.user?.first_name || '';
  lastName.value = appStore.user?.last_name || '';
  timezone.value = appStore.user?.timezone || '';
  errors.value = {};
}

const userDisplayName = computed(() => {
  const fullName = `${firstName.value || ''} ${lastName.value || ''}`.trim();
  return fullName || appStore.user?.email || '未设置姓名';
});

const timezoneLabel = computed(() => {
  const current = timezone.value || appStore.user?.timezone || '';
  return current ? getTimezoneLabel(current) : '未设置';
});

const primaryEmail = computed(() => emails.value.find((item) => item.primary)?.email || appStore.user?.email || '未设置');
const passkeys = computed(() => authenticators.value.filter((item) => item.type === 'webauthn'));
const totp = computed(() => authenticators.value.find((item) => item.type === 'totp'));
const githubAccount = computed(() => socialAccounts.value.find((item) => item.provider.id === 'github'));

const verificationMeta = computed(() => {
  const status = appStore.user?.real_name_status || 'unverified';

  if (status === 'verified') {
    return {
      label: '已认证',
      description: appStore.user?.real_name_masked || '实名认证已完成',
      badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    };
  }

  if (status === 'pending') {
    return {
      label: '审核中',
      description: '实名认证资料已提交，等待审核',
      badgeClass: 'bg-amber-50 text-amber-700 ring-amber-200',
    };
  }

  return {
    label: '未认证',
    description: '建议补充实名认证信息',
    badgeClass: 'bg-slate-100 text-slate-700 ring-slate-200',
  };
});

const secondaryBadge = computed(() => {
  if (appStore.user?.phone_verified) {
    return {
      label: '已绑定手机',
      badgeClass: 'bg-blue-50 text-blue-700 ring-blue-200',
    };
  }

  if (appStore.user?.is_superuser) {
    return {
      label: '超级管理员',
      badgeClass: 'bg-violet-50 text-violet-700 ring-violet-200',
    };
  }

  if (appStore.user?.is_staff) {
    return {
      label: '管理员',
      badgeClass: 'bg-violet-50 text-violet-700 ring-violet-200',
    };
  }

  return {
    label: '资料待完善',
    badgeClass: 'bg-slate-100 text-slate-700 ring-slate-200',
  };
});

const securityFeatureCount = computed(() => {
  return [Boolean(appStore.user?.phone_verified), Boolean(totp.value), passkeys.value.length > 0, Boolean(githubAccount.value)].filter(Boolean).length;
});

const enabledNotificationCount = computed(() => notificationPrefs.value.filter((item) => item.in_app || item.email).length);

const overviewCards = computed(() => [
  {
    title: '组织协作',
    value: `${appStore.organizations?.length || 0}`,
    helper: '当前可访问组织',
    icon: BuildingOffice2Icon,
  },
  {
    title: '邮箱地址',
    value: metaLoading.value ? '...' : `${emails.value.length || 1}`,
    helper: '主邮箱可用于登录',
    icon: EnvelopeIcon,
  },
  {
    title: '安全能力',
    value: metaLoading.value ? '...' : `${securityFeatureCount.value}`,
    helper: '已启用的安全项',
    icon: ShieldCheckIcon,
  },
  {
    title: '通知偏好',
    value: metaLoading.value ? '...' : `${enabledNotificationCount.value}`,
    helper: '已开启的通知分类',
    icon: BellIcon,
  },
]);

const profileItems = computed(() => [
  {
    label: '姓名',
    value: userDisplayName.value,
  },
  {
    label: '邮箱',
    value: primaryEmail.value,
  },
  {
    label: '手机号',
    value: appStore.user?.phone || '未设置',
    hint: appStore.user?.phone_verified ? '已验证' : '未验证',
  },
  {
    label: '所在时区',
    value: timezoneLabel.value,
    hint: timezone.value || '未设置',
  },
  {
    label: '用户名',
    value: appStore.user?.username || '未设置',
  },
  {
    label: '实名认证',
    value: verificationMeta.value.label,
    hint: verificationMeta.value.description,
  },
]);

const securityRows = computed(() => [
  {
    title: '修改密码',
    detail: '更新当前登录密码，保持账户安全。',
    actionLabel: '修改',
    to: { name: 'account-password-change' },
    icon: KeyIcon,
    primary: false,
  },
  {
    title: '邮箱地址',
    detail: `当前主邮箱：${primaryEmail.value}`,
    actionLabel: '管理',
    to: { name: 'account-email' },
    icon: EnvelopeIcon,
    primary: false,
  },
  {
    title: '双重身份验证',
    detail: totp.value || passkeys.value.length
      ? `已启用${totp.value ? '验证器' : ''}${totp.value && passkeys.value.length ? ' / ' : ''}${passkeys.value.length ? `Passkey ${passkeys.value.length} 个` : ''}`
      : '未启用，建议尽快开启。',
    actionLabel: totp.value || passkeys.value.length ? '管理' : '立即启用',
    to: { name: 'account-security' },
    icon: LockClosedIcon,
    primary: !(totp.value || passkeys.value.length),
  },
  {
    title: 'Passkeys',
    detail: passkeys.value.length
      ? `已添加 ${passkeys.value.length} 个 Passkey，可用于无密码登录。`
      : '尚未添加 Passkey。',
    actionLabel: passkeys.value.length ? '查看' : '添加',
    to: { name: 'account-passkeys' },
    icon: CreditCardIcon,
    primary: false,
  },
]);

const statusItems = computed(() => [
  {
    title: verificationMeta.value.label === '已认证' ? '实名认证已完成' : '实名认证待完善',
    detail: verificationMeta.value.description,
    icon: CheckCircleIcon,
    iconClass: verificationMeta.value.label === '已认证' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500',
  },
  {
    title: securityFeatureCount.value ? `已启用 ${securityFeatureCount.value} 项安全能力` : '尚未启用额外安全能力',
    detail: securityFeatureCount.value
      ? '建议继续维护密码、MFA 和 Passkey 的组合安全策略。'
      : '可在安全设置中开启双重身份验证或添加 Passkey。',
    icon: ShieldCheckIcon,
    iconClass: securityFeatureCount.value ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500',
  },
  {
    title: enabledNotificationCount.value ? `通知偏好已配置 ${enabledNotificationCount.value} 类` : '通知偏好尚未配置',
    detail: enabledNotificationCount.value
      ? '你可以继续精细控制站内与邮件通知的接收方式。'
      : '前往通知设置决定接收哪些站内和邮件提醒。',
    icon: BellIcon,
    iconClass: enabledNotificationCount.value ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500',
  },
]);

const quickLinks = computed(() => {
  const links = [
    {
      label: '通知设置',
      description: '管理站内与邮件提醒',
      to: { name: 'account-notifications' },
      icon: BellIcon,
    },
    {
      label: '安全中心',
      description: '查看 MFA、Passkey 和 GitHub 登录',
      to: { name: 'account-security' },
      icon: ShieldCheckIcon,
    },
    {
      label: '邮箱地址',
      description: '增加、验证和切换主邮箱',
      to: { name: 'account-email' },
      icon: EnvelopeIcon,
    },
  ];

  if (appStore.org?.slug) {
    links.push({
      label: '组织设置',
      description: `查看 ${appStore.org.name} 的设置`,
      to: { name: 'org-settings-general', params: { slug: appStore.org.slug } },
      icon: BuildingOffice2Icon,
    });
  }

  return links;
});

function startEditing() {
  resetForm();
  editing.value = true;
}

function cancelEditing() {
  resetForm();
  editing.value = false;
}

function onTimezoneChange(value) {
  timezone.value = value;
}

async function loadMeta() {
  metaLoading.value = true;

  const [emailsResult, authenticatorsResult, notificationsResult, socialResult] = await Promise.allSettled([
    authApi.listEmails(),
    authApi.listAuthenticators(),
    get('/api/notifications/preferences/'),
    authApi.getSocialAccounts(),
  ]);

  if (emailsResult.status === 'fulfilled') {
    emails.value = emailsResult.value.data || [];
  }
  if (authenticatorsResult.status === 'fulfilled') {
    authenticators.value = authenticatorsResult.value.data || [];
  }
  if (notificationsResult.status === 'fulfilled') {
    notificationPrefs.value = notificationsResult.value || [];
  }
  if (socialResult.status === 'fulfilled') {
    socialAccounts.value = socialResult.value.data || [];
  }

  metaLoading.value = false;
}

async function onSubmit() {
  loading.value = true;
  errors.value = {};

  try {
    const data = await patch(`/api/users/${appStore.user.id}/`, {
      first_name: firstName.value,
      last_name: lastName.value,
      timezone: timezone.value,
    });

    appStore.setUser({
      ...appStore.user,
      ...data,
      timezone_display: getTimezoneLabel(data.timezone || timezone.value),
    });
    editing.value = false;
    showToast('个人资料已更新。');
  } catch (err) {
    errors.value = parseErrors(err);
  } finally {
    loading.value = false;
  }
}

onMounted(loadMeta);
</script>

<template>
  <AccountLayout wide>
    <div class="space-y-6 bg-slate-50/50">
      <section class="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-sm sm:px-8">
        <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex items-start gap-5 sm:items-center">
            <div class="relative">
              <img
                v-if="appStore.user?.avatar_url"
                :src="appStore.user.avatar_url"
                alt=""
                class="h-24 w-24 rounded-full object-cover ring-4 ring-slate-100"
              >
              <UserAvatar
                v-else
                :name="userDisplayName"
                size="rail"
                class="!h-24 !w-24 !text-3xl ring-4 ring-slate-100"
              />
              <button
                type="button"
                class="absolute bottom-1 right-1 inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-700 text-white shadow-sm transition hover:bg-blue-800"
                @click="startEditing"
              >
                <PencilSquareIcon class="h-5 w-5" />
              </button>
            </div>

            <div class="space-y-3 pt-1">
              <div>
                <h2 class="text-3xl font-semibold text-slate-900">
                  {{ userDisplayName }}
                </h2>
                <p class="mt-2 text-xl text-slate-600">
                  {{ primaryEmail }}
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset"
                  :class="verificationMeta.badgeClass"
                >
                  {{ verificationMeta.label }}
                </span>
                <span
                  class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset"
                  :class="secondaryBadge.badgeClass"
                >
                  {{ secondaryBadge.label }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3 lg:self-start">
            <button
              v-if="!editing"
              type="button"
              class="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-blue-700 px-6 py-3 text-lg font-semibold text-white transition hover:bg-blue-800"
              @click="startEditing"
            >
              编辑资料
            </button>
            <button
              v-else
              type="button"
              class="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
              @click="cancelEditing"
            >
              取消编辑
            </button>
          </div>
        </div>
      </section>

      <section class="rounded-[28px] border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
        <div class="flex items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h3 class="text-2xl font-semibold text-slate-900">
              个人资料
            </h3>
            <p class="mt-2 text-sm text-slate-500">
              默认展示资料信息，点击右上角进入编辑态。
            </p>
          </div>
        </div>

        <div
          v-if="!editing"
          class="pt-8"
        >
          <div class="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            <div
              v-for="item in profileItems"
              :key="item.label"
              class="space-y-2"
            >
              <p class="text-lg font-medium text-slate-500">
                {{ item.label }}
              </p>
              <p class="text-2xl font-semibold text-slate-900">
                {{ item.value }}
              </p>
              <p
                v-if="item.hint"
                class="text-sm text-slate-500"
              >
                {{ item.hint }}
              </p>
            </div>
          </div>
        </div>

        <form
          v-else
          class="space-y-6 pt-8"
          @submit.prevent="onSubmit"
        >
          <FormErrors :errors="errors.non_field_errors || []" />

          <div class="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <p class="text-base font-medium text-slate-700">
              头像
            </p>
            <div class="mt-4">
              <AvatarCropper
                :current-avatar-url="appStore.user?.avatar_url || ''"
                :user-name="userDisplayName"
                upload-url="/api/avatar/"
              />
            </div>
          </div>

          <div class="grid gap-4 lg:grid-cols-2">
            <label class="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <span class="text-sm font-medium text-slate-500">名字</span>
              <input
                v-model="firstName"
                type="text"
                autocomplete="given-name"
                placeholder="输入名字"
                class="mt-3 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-lg text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-blue-500"
              >
              <p
                v-for="err in errors.first_name || []"
                :key="err"
                class="mt-2 text-sm text-red-600"
              >
                {{ err }}
              </p>
            </label>

            <label class="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <span class="text-sm font-medium text-slate-500">姓氏</span>
              <input
                v-model="lastName"
                type="text"
                autocomplete="family-name"
                placeholder="输入姓氏"
                class="mt-3 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-lg text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-blue-500"
              >
              <p
                v-for="err in errors.last_name || []"
                :key="err"
                class="mt-2 text-sm text-red-600"
              >
                {{ err }}
              </p>
            </label>
          </div>

          <div class="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div class="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <p class="text-sm font-medium text-slate-500">
                所在时区
              </p>
              <div class="mt-3">
                <TimezoneSelectApp
                  :current-timezone="timezone"
                  field-name="timezone"
                  :model-value="timezone"
                  @update:model-value="onTimezoneChange"
                />
              </div>
              <p
                v-for="err in errors.timezone || []"
                :key="err"
                class="mt-2 text-sm text-red-600"
              >
                {{ err }}
              </p>
            </div>

            <div class="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <p class="text-sm font-medium text-slate-500">
                当前邮箱
              </p>
              <p class="mt-3 text-lg font-semibold text-slate-900">
                {{ primaryEmail }}
              </p>
              <RouterLink
                :to="{ name: 'account-email' }"
                class="mt-4 inline-flex text-sm font-medium text-blue-700 hover:text-blue-800"
              >
                前往邮箱地址页管理
              </RouterLink>
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              class="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
              @click="cancelEditing"
            >
              取消
            </button>
            <button
              type="submit"
              :disabled="loading"
              class="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-blue-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {{ loading ? '保存中...' : '保存资料' }}
            </button>
          </div>
        </form>
      </section>

      <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article
          v-for="card in overviewCards"
          :key="card.title"
          class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div class="flex items-start justify-between gap-3">
            <p class="text-xl font-semibold text-slate-700">
              {{ card.title }}
            </p>
            <component
              :is="card.icon"
              class="h-6 w-6 text-slate-500"
            />
          </div>
          <p class="mt-5 text-4xl font-semibold text-slate-900">
            {{ card.value }}
          </p>
          <p class="mt-2 text-sm text-slate-500">
            {{ card.helper }}
          </p>
        </article>
      </section>

      <section class="rounded-[28px] border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
        <div class="border-b border-slate-200 pb-6">
          <h3 class="text-2xl font-semibold text-slate-900">
            安全设置
          </h3>
        </div>

        <div class="divide-y divide-slate-200">
          <div
            v-for="row in securityRows"
            :key="row.title"
            class="flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between"
          >
            <div class="flex items-start gap-4">
              <div class="mt-1 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                <component
                  :is="row.icon"
                  class="h-5 w-5"
                />
              </div>
              <div>
                <p class="text-xl font-semibold text-slate-900">
                  {{ row.title }}
                </p>
                <p class="mt-2 text-sm text-slate-500">
                  {{ row.detail }}
                </p>
              </div>
            </div>

            <RouterLink
              :to="row.to"
              class="inline-flex min-w-[112px] items-center justify-center rounded-2xl px-5 py-3 text-lg font-semibold transition"
              :class="row.primary
                ? 'bg-blue-700 text-white hover:bg-blue-800'
                : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'"
            >
              {{ row.actionLabel }}
            </RouterLink>
          </div>
        </div>
      </section>

      <div class="grid gap-6 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,1fr)]">
        <section class="rounded-[28px] border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
          <div class="flex items-center justify-between gap-4">
            <h3 class="text-2xl font-semibold text-slate-900">
              账户状态
            </h3>
            <RouterLink
              :to="{ name: 'account-security' }"
              class="text-lg font-semibold text-blue-700 transition hover:text-blue-800"
            >
              查看全部
            </RouterLink>
          </div>

          <div class="mt-8 space-y-6">
            <article
              v-for="item in statusItems"
              :key="item.title"
              class="flex items-start gap-4"
            >
              <div
                class="inline-flex h-12 w-12 items-center justify-center rounded-full"
                :class="item.iconClass"
              >
                <component
                  :is="item.icon"
                  class="h-6 w-6"
                />
              </div>
              <div>
                <p class="text-2xl font-semibold text-slate-900">
                  {{ item.title }}
                </p>
                <p class="mt-2 text-base text-slate-500">
                  {{ item.detail }}
                </p>
              </div>
            </article>
          </div>
        </section>

        <section class="rounded-[28px] border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
          <div class="flex items-center gap-3">
            <SparklesIcon class="h-6 w-6 text-blue-700" />
            <h3 class="text-2xl font-semibold text-slate-900">
              快捷链接
            </h3>
          </div>

          <div class="mt-8 space-y-4">
            <RouterLink
              v-for="link in quickLinks"
              :key="link.label"
              :to="link.to"
              class="flex items-center justify-between rounded-2xl border border-slate-200 px-5 py-4 transition hover:border-blue-200 hover:bg-blue-50/50"
            >
              <div class="flex items-center gap-4">
                <div class="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <component
                    :is="link.icon"
                    class="h-5 w-5"
                  />
                </div>
                <div>
                  <p class="text-xl font-semibold text-slate-900">
                    {{ link.label }}
                  </p>
                  <p class="mt-1 text-sm text-slate-500">
                    {{ link.description }}
                  </p>
                </div>
              </div>
              <ChevronRightIcon class="h-5 w-5 text-slate-400" />
            </RouterLink>
          </div>

          <div
            v-if="githubAccount"
            class="mt-6 rounded-[24px] border border-blue-100 bg-blue-50/60 p-5"
          >
            <p class="text-sm font-medium text-blue-700">
              GitHub 已连接
            </p>
            <p class="mt-2 text-base text-slate-700">
              当前绑定账号：{{ githubAccount.display }}
            </p>
          </div>
        </section>
      </div>
    </div>
  </AccountLayout>
</template>
