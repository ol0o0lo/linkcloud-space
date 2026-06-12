<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { Alert, Button, Card, Empty, Input, InputPassword, Modal, Space, Spin, Switch, Tag, message } from 'antdv-next';

import {
  activateTotpApi,
  addPasskeyApi,
  beginAddPasskeyApi,
  deactivateTotpApi,
  disconnectSocialApi,
  getSocialAccountsApi,
  getTotpStatusApi,
  listAuthenticatorsApi,
  listRecoveryCodesApi,
  parseAllauthErrors,
  reauthenticateApi,
  redirectProviderConnect,
  regenerateRecoveryCodesApi,
  removePasskeyApi,
  renamePasskeyApi,
  type AuthenticatorRow,
  type RecoveryCodesRow,
  type SocialAccountRow,
} from '#/api/django/auth';
import { createPasskeyCredential, isWebAuthnSupported } from '#/api/django/webauthn';

type FieldErrors = Record<string, string[]>;
type ProtectedActionOptions = {
  action: () => Promise<void>;
  onError?: (error: any) => void;
  onSuccess?: () => Promise<void> | void;
};

const emit = defineEmits<{
  editChange: [editing: boolean];
  statusChange: [];
}>();

const loading = ref(false);
const authenticators = ref<AuthenticatorRow[]>([]);
const socialAccounts = ref<SocialAccountRow[]>([]);
const actionLoading = ref<Record<string, boolean>>({});

const totpSecret = ref('');
const totpUrl = ref('');
const totpCode = ref('');
const totpErrors = ref<FieldErrors>({});

const recoveryCodes = ref<string[]>([]);
const recoveryUnused = ref<string[]>([]);
const recoveryTotal = ref(0);
const showRecoveryCodes = ref(false);

const detailsOpen = ref(false);
const newPasskeyName = ref('');
const passwordless = ref(true);
const passkeyErrors = ref<FieldErrors>({});
const supported = ref(true);

const needsReauth = ref(false);
const reauthLoading = ref(false);
const reauthPassword = ref('');
const reauthErrors = ref<FieldErrors>({});
let pendingAction: null | (() => Promise<unknown>) = null;

const totp = computed(() => authenticators.value.find((item) => item.type === 'totp') ?? null);
const recoveryAuthenticator = computed(() => authenticators.value.find((item) => item.type === 'recovery_codes') ?? null);
const passkeys = computed(() => authenticators.value.filter((item) => item.type === 'webauthn'));
const githubAccount = computed(() => socialAccounts.value.find((item) => item.provider?.id === 'github') ?? null);
const socialAccountCount = computed(() => socialAccounts.value.length);

function toggleDetails(open: boolean) {
  detailsOpen.value = open;
  if (!open) {
    closeReauth();
  }
  emit('editChange', open);
}

function setActionLoading(key: string, value: boolean) {
  actionLoading.value = {
    ...actionLoading.value,
    [key]: value,
  };
}

function unwrapAllauthData<T>(payload: any): T {
  return (payload?.data ?? payload) as T;
}

function isReauthRequired(error: any) {
  if (error?.response?.status !== 401) return false;
  const flows = error?.data?.data?.flows ?? error?.data?.flows ?? [];
  return flows.some((flow: any) => ['mfa_reauthenticate', 'reauthenticate'].includes(flow?.id));
}

async function executeProtectedAction(options: ProtectedActionOptions) {
  const runner = async (): Promise<boolean> => {
    try {
      await options.action();
      await options.onSuccess?.();
      return true;
    } catch (error: any) {
      if (isReauthRequired(error)) {
        pendingAction = runner;
        reauthErrors.value = {};
        needsReauth.value = true;
        return false;
      }

      if (options.onError) {
        options.onError(error);
        return false;
      }

      throw error;
    }
  };

  return await runner();
}

async function prepareTotpSetup() {
  try {
    const data = await getTotpStatusApi();
    const payload = unwrapAllauthData<any>(data);
    totpSecret.value = payload?.secret || '';
    totpUrl.value = payload?.totp_url || '';
  } catch (error: any) {
    if (error?.response?.status === 404) {
      const payload = error?.data?.meta ?? error?.data?.data ?? {};
      totpSecret.value = payload?.secret || '';
      totpUrl.value = payload?.totp_url || '';
      return;
    }
    throw error;
  }
}

async function loadSecurityData() {
  loading.value = true;
  try {
    const [authenticatorResponse, socialResponse] = await Promise.all([
      listAuthenticatorsApi().catch(() => ({ data: [] })),
      getSocialAccountsApi().catch(() => ({ data: [] })),
    ]);
    authenticators.value = unwrapAllauthData<AuthenticatorRow[]>(authenticatorResponse) || [];
    socialAccounts.value = unwrapAllauthData<SocialAccountRow[]>(socialResponse) || [];

    if (totp.value) {
      totpSecret.value = '';
      totpUrl.value = '';
    } else {
      await prepareTotpSetup();
    }
  } finally {
    loading.value = false;
  }
}

async function enableTotp() {
  if (!totpCode.value.trim()) {
    totpErrors.value = { code: ['请输入验证码'] };
    return;
  }

  totpErrors.value = {};
  setActionLoading('totp', true);
  try {
    await executeProtectedAction({
      action: async () => {
        await activateTotpApi(totpCode.value.trim());
      },
      onError: (error) => {
        totpErrors.value = error?.data ? parseAllauthErrors(error.data) : { non_field_errors: ['启用验证器失败，请稍后重试。'] };
      },
      onSuccess: async () => {
        totpCode.value = '';
        message.success('验证器已启用');
        await loadSecurityData();
        emit('statusChange');
      },
    });
  } finally {
    setActionLoading('totp', false);
  }
}

async function disableTotp() {
  Modal.confirm({
    cancelText: '取消',
    okText: '确认关闭',
    title: '关闭验证器',
    content: '关闭后，登录时将不再要求输入 TOTP 验证码。',
    async onOk() {
      setActionLoading('totp-disable', true);
      try {
        await executeProtectedAction({
          action: async () => {
            await deactivateTotpApi();
          },
          onError: () => {
            message.error('关闭验证器失败，请稍后重试。');
          },
          onSuccess: async () => {
            showRecoveryCodes.value = false;
            recoveryCodes.value = [];
            recoveryUnused.value = [];
            recoveryTotal.value = 0;
            message.success('验证器已关闭');
            await loadSecurityData();
            emit('statusChange');
          },
        });
      } finally {
        setActionLoading('totp-disable', false);
      }
    },
  });
}

async function loadRecoveryCodes() {
  setActionLoading('recovery', true);
  try {
    await executeProtectedAction({
      action: async () => {
        const data = await listRecoveryCodesApi();
        const payload = unwrapAllauthData<RecoveryCodesRow>(data) || {};
        recoveryCodes.value = payload.unused_codes || payload.codes || [];
        recoveryUnused.value = payload.unused_codes || [];
        recoveryTotal.value = payload.total_code_count || recoveryCodes.value.length;
        showRecoveryCodes.value = true;
      },
      onError: () => {
        message.error('读取恢复码失败，请稍后重试。');
      },
    });
  } finally {
    setActionLoading('recovery', false);
  }
}

async function regenerateRecoveryCodes() {
  Modal.confirm({
    cancelText: '取消',
    okText: '确认重置',
    title: '重置恢复码',
    content: '重新生成后，当前所有恢复码都会立即失效。',
    async onOk() {
      setActionLoading('recovery-regenerate', true);
      try {
        await executeProtectedAction({
          action: async () => {
            await regenerateRecoveryCodesApi();
          },
          onError: () => {
            message.error('恢复码重置失败，请稍后重试。');
          },
          onSuccess: async () => {
            message.success('恢复码已重新生成');
            await loadRecoveryCodes();
            await loadSecurityData();
            emit('statusChange');
          },
        });
      } finally {
        setActionLoading('recovery-regenerate', false);
      }
    },
  });
}

async function copyRecoveryCodes() {
  if (recoveryCodes.value.length === 0) return;
  await navigator.clipboard.writeText(recoveryCodes.value.join('\n'));
  message.success('恢复码已复制到剪贴板');
}

async function addPasskey() {
  if (!supported.value) {
    passkeyErrors.value = { non_field_errors: ['当前浏览器不支持 Passkey。'] };
    return;
  }

  passkeyErrors.value = {};
  setActionLoading('passkey-add', true);
  try {
    await executeProtectedAction({
      action: async () => {
        const data = await beginAddPasskeyApi(passwordless.value);
        const payload = unwrapAllauthData<any>(data);
        const options = payload?.creation_options ?? payload;
        const credential = await createPasskeyCredential(options);
        await addPasskeyApi(newPasskeyName.value.trim() || 'Passkey', credential);
      },
      onError: (error) => {
        if (error?.name === 'AbortError' || error?.name === 'NotAllowedError') {
          return;
        }
        passkeyErrors.value = error?.data
          ? parseAllauthErrors(error.data)
          : { non_field_errors: [error?.message || '添加 Passkey 失败，请稍后重试。'] };
      },
      onSuccess: async () => {
        newPasskeyName.value = '';
        message.success('Passkey 已添加');
        await loadSecurityData();
        emit('statusChange');
      },
    });
  } finally {
    setActionLoading('passkey-add', false);
  }
}

async function renamePasskey(passkey: AuthenticatorRow) {
  if (!passkey.id) return;
  const name = window.prompt('请输入新的 Passkey 名称', passkey.name || 'Passkey');
  if (!name || name === passkey.name) return;

  setActionLoading(`passkey-rename-${passkey.id}`, true);
  try {
    await executeProtectedAction({
      action: async () => {
        await renamePasskeyApi(passkey.id as number, name);
      },
      onError: () => {
        message.error('Passkey 重命名失败，请稍后重试。');
      },
      onSuccess: async () => {
        message.success('Passkey 名称已更新');
        await loadSecurityData();
        emit('statusChange');
      },
    });
  } finally {
    setActionLoading(`passkey-rename-${passkey.id}`, false);
  }
}

async function removePasskey(passkey: AuthenticatorRow) {
  if (!passkey.id) return;

  Modal.confirm({
    cancelText: '取消',
    okText: '确认移除',
    title: '移除 Passkey',
    content: `移除后，${passkey.name || '该 Passkey'} 将不能再用于登录。`,
    async onOk() {
      setActionLoading(`passkey-remove-${passkey.id}`, true);
      try {
        await executeProtectedAction({
          action: async () => {
            await removePasskeyApi(passkey.id as number);
          },
          onError: () => {
            message.error('Passkey 移除失败，请稍后重试。');
          },
          onSuccess: async () => {
            message.success('Passkey 已移除');
            await loadSecurityData();
            emit('statusChange');
          },
        });
      } finally {
        setActionLoading(`passkey-remove-${passkey.id}`, false);
      }
    },
  });
}

async function connectGithub() {
  setActionLoading('github-connect', true);
  try {
    const callbackUrl = `${window.location.origin}/dashboard/account/social/callback?next=${encodeURIComponent('/profile/security')}`;
    await redirectProviderConnect('github', callbackUrl);
  } catch {
    setActionLoading('github-connect', false);
  }
}

async function disconnectGithub() {
  if (!githubAccount.value) return;

  setActionLoading('github-disconnect', true);
  try {
    await executeProtectedAction({
      action: async () => {
        await disconnectSocialApi('github', githubAccount.value?.uid || '');
      },
      onError: () => {
        message.error('解除 GitHub 绑定失败，请稍后重试。');
      },
      onSuccess: async () => {
        message.success('GitHub 绑定已解除');
        await loadSecurityData();
        emit('statusChange');
      },
    });
  } finally {
    setActionLoading('github-disconnect', false);
  }
}

async function submitReauth() {
  reauthErrors.value = {};
  reauthLoading.value = true;
  try {
    await reauthenticateApi(reauthPassword.value);
    const action = pendingAction;
    pendingAction = null;
    needsReauth.value = false;
    reauthPassword.value = '';
    if (action) {
      await action();
    }
  } catch (error: any) {
    reauthErrors.value = error?.data ? parseAllauthErrors(error.data) : { non_field_errors: ['密码校验失败，请重试。'] };
  } finally {
    reauthLoading.value = false;
  }
}

function closeReauth() {
  needsReauth.value = false;
  reauthPassword.value = '';
  reauthErrors.value = {};
  pendingAction = null;
}

onMounted(() => {
  supported.value = isWebAuthnSupported();
  loadSecurityData();
});
</script>

<template>
  <Spin :spinning="loading">
    <div>
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div class="text-xl font-semibold text-zinc-950 dark:text-zinc-50">账户安全</div>
          <div class="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            默认先看安全概览，点击后再进入管理态处理验证器、Passkey 和绑定信息。
          </div>
        </div>

        <Button class="w-full sm:w-auto" type="primary" @click="toggleDetails(!detailsOpen)">
          {{ detailsOpen ? '完成' : '管理安全方式' }}
        </Button>
      </div>

      <div class="mt-6 grid gap-4 lg:grid-cols-2">
        <div class="rounded-[28px] border border-slate-200/80 bg-slate-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">两步验证与设备</div>
              <div class="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                验证器、恢复码和 Passkey 统一归在这里，优先展示当前是否已经具备多层防护。
              </div>
            </div>
            <Tag :color="totp ? 'green' : 'gold'">{{ totp ? '保护中' : '待加强' }}</Tag>
          </div>

          <div class="mt-5 grid gap-3 sm:grid-cols-2">
            <div class="rounded-2xl border border-white/90 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-950/60">
              <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">验证器</div>
              <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">{{ totp ? '已开启' : '未开启' }}</div>
            </div>
            <div class="rounded-2xl border border-white/90 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-950/60">
              <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Passkey</div>
              <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">已添加 {{ passkeys.length }} 个</div>
            </div>
          </div>

          <div class="mt-4 rounded-2xl border border-white/90 bg-white px-4 py-3 text-sm text-zinc-500 dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-400">
            {{ recoveryAuthenticator ? `${recoveryAuthenticator.unused_code_count || 0}/${recoveryAuthenticator.total_code_count || 0} 个恢复码可用` : '尚未生成恢复码，建议完成验证器配置后备份。' }}
          </div>
        </div>

        <div class="rounded-[28px] border border-slate-200/80 bg-slate-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">第三方账号</div>
              <div class="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                管理 GitHub 等外部登录方式，减少密码输入，同时保留独立的密码更新入口。
              </div>
            </div>
            <Tag :color="githubAccount ? 'green' : 'default'">{{ githubAccount ? '已绑定' : '未绑定' }}</Tag>
          </div>

          <div class="mt-5 grid gap-3 sm:grid-cols-2">
            <div class="rounded-2xl border border-white/90 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-950/60">
              <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">已绑定账号</div>
              <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">{{ socialAccountCount }} 个</div>
            </div>
            <div class="rounded-2xl border border-white/90 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-950/60">
              <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">登录密码</div>
              <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">已设置，可按需更新</div>
            </div>
          </div>

          <div class="mt-4 rounded-2xl border border-white/90 bg-white px-4 py-3 text-sm text-zinc-500 dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-400">
            {{ githubAccount ? '当前账号已连接 GitHub，可用于快捷登录。' : '目前还没有绑定第三方账号，后续可在这里连接。' }}
          </div>
        </div>
      </div>

      <div v-if="detailsOpen" class="mt-8 grid gap-6">
        <Card :bordered="false" class="shadow-none ring-1 ring-zinc-200/80 dark:ring-zinc-800">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">验证器与恢复码</div>
              <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                启用验证器后，恢复码会作为兜底方案一起保留，建议同步备份。
              </div>
            </div>
            <Tag :color="totp ? 'green' : 'default'">{{ totp ? '验证器已启用' : '验证器未启用' }}</Tag>
          </div>

          <div v-if="totp" class="mt-5 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="text-sm text-zinc-500 dark:text-zinc-400">恢复码会继续保留，建议在关闭前确认是否已经备份。</div>
              <Button :loading="actionLoading['totp-disable']" danger @click="disableTotp">关闭验证器</Button>
            </div>
          </div>

          <div v-else class="mt-5 grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
            <div v-if="totpUrl" class="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <img
                :src="`/qr/?data=${encodeURIComponent(totpUrl)}`"
                alt="TOTP QR code"
                class="mx-auto block"
                height="180"
                width="180"
              >
            </div>
            <div>
              <Alert
                v-if="totpErrors.non_field_errors?.length"
                :message="totpErrors.non_field_errors[0]"
                class="mb-4"
                show-icon
                type="error"
              />
              <div class="text-sm text-zinc-600 dark:text-zinc-300">
                扫描二维码后，输入验证器应用生成的 6 位验证码完成绑定。
              </div>
              <div v-if="totpSecret" class="mt-3 rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200">
                手动输入密钥：<span class="font-mono">{{ totpSecret }}</span>
              </div>
              <div class="mt-4 max-w-sm">
                <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">验证码</div>
                <Input v-model:value="totpCode" autocomplete="one-time-code" placeholder="请输入 6 位验证码" />
                <div v-if="totpErrors.code?.length" class="mt-2 text-sm text-rose-500">{{ totpErrors.code[0] }}</div>
              </div>
              <div class="mt-4">
                <Button :loading="actionLoading.totp" type="primary" @click="enableTotp">启用验证器</Button>
              </div>
            </div>
          </div>

          <div class="mt-6 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div class="text-sm font-semibold text-zinc-950 dark:text-zinc-50">恢复码</div>
                <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  当你暂时无法访问验证器应用时，可以用恢复码完成一次性登录验证。
                </div>
              </div>
              <Tag :color="recoveryAuthenticator ? 'blue' : 'default'">
                {{ recoveryAuthenticator ? `${recoveryAuthenticator.unused_code_count || 0}/${recoveryAuthenticator.total_code_count || 0} 可用` : '尚未生成' }}
              </Tag>
            </div>

            <div class="mt-5 flex flex-wrap gap-3">
              <Button :disabled="!recoveryAuthenticator" :loading="actionLoading.recovery" @click="loadRecoveryCodes">
                查看恢复码
              </Button>
              <Button
                :disabled="!recoveryAuthenticator"
                :loading="actionLoading['recovery-regenerate']"
                type="primary"
                ghost
                @click="regenerateRecoveryCodes"
              >
                重新生成
              </Button>
            </div>

            <div v-if="showRecoveryCodes" class="mt-5 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div v-if="recoveryCodes.length" class="space-y-4">
                <div class="grid gap-2 rounded-xl bg-zinc-50 p-4 font-mono text-sm dark:bg-zinc-900/60 md:grid-cols-2">
                  <div v-for="code in recoveryCodes" :key="code">{{ code }}</div>
                </div>
                <div class="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                  <span>{{ recoveryUnused.length }} / {{ recoveryTotal }} 个恢复码尚未使用</span>
                  <Button @click="copyRecoveryCodes">复制全部</Button>
                </div>
              </div>
              <Empty v-else description="当前没有可显示的恢复码" />
            </div>
          </div>
        </Card>

        <Card :bordered="false" class="shadow-none ring-1 ring-zinc-200/80 dark:ring-zinc-800">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">Passkey</div>
              <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                使用本机生物识别或安全密钥，减少密码输入频次，同时保留传统 MFA 流程。
              </div>
            </div>
            <Tag :color="passkeys.length ? 'green' : 'default'">{{ passkeys.length }} 个已登记</Tag>
          </div>

          <Alert
            v-if="!supported"
            class="mt-4"
            message="当前浏览器不支持 Passkey，请改用支持 WebAuthn 的浏览器。"
            show-icon
            type="warning"
          />

          <div class="mt-5 space-y-5">
            <div v-if="passkeys.length" class="space-y-3">
              <div
                v-for="passkey in passkeys"
                :key="passkey.id || passkey.name"
                class="flex flex-col gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800 lg:flex-row lg:items-center lg:justify-between"
              >
                <div>
                  <div class="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{{ passkey.name || 'Passkey' }}</div>
                  <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {{ passkey.is_passwordless ? '可直接无密码登录' : '作为二次验证设备使用' }}
                  </div>
                </div>
                <Space>
                  <Button :loading="actionLoading[`passkey-rename-${passkey.id}`]" @click="renamePasskey(passkey)">重命名</Button>
                  <Button :loading="actionLoading[`passkey-remove-${passkey.id}`]" danger ghost @click="removePasskey(passkey)">移除</Button>
                </Space>
              </div>
            </div>
            <Empty v-else description="还没有登记任何 Passkey" />

            <div class="rounded-2xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
              <Alert
                v-if="passkeyErrors.non_field_errors?.length"
                :message="passkeyErrors.non_field_errors[0]"
                class="mb-4"
                show-icon
                type="error"
              />
              <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px]">
                <div>
                  <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">设备名称</div>
                  <Input v-model:value="newPasskeyName" placeholder="例如：MacBook Pro / YubiKey / iPhone" />
                  <div v-if="passkeyErrors.name?.length" class="mt-2 text-sm text-rose-500">{{ passkeyErrors.name[0] }}</div>
                </div>
                <div class="rounded-xl bg-zinc-50 px-4 py-3 dark:bg-zinc-900/60">
                  <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">登录方式</div>
                  <div class="mt-3 flex items-center justify-between gap-3">
                    <span class="text-sm text-zinc-700 dark:text-zinc-200">允许无密码登录</span>
                    <Switch v-model:checked="passwordless" />
                  </div>
                </div>
              </div>
              <div class="mt-4">
                <Button :disabled="!supported" :loading="actionLoading['passkey-add']" type="primary" @click="addPasskey">
                  添加 Passkey
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card :bordered="false" class="shadow-none ring-1 ring-zinc-200/80 dark:ring-zinc-800">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">第三方账号绑定</div>
              <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                当前使用 GitHub 作为快捷登录来源，后续如扩展更多提供商也会归并到这里管理。
              </div>
            </div>
            <Tag :color="githubAccount ? 'green' : 'default'">{{ githubAccount ? '已连接 GitHub' : '尚未连接 GitHub' }}</Tag>
          </div>

          <div class="mt-5 flex flex-col gap-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div class="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {{ githubAccount ? githubAccount.display : 'GitHub' }}
              </div>
              <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {{ githubAccount ? '已经与当前账号建立绑定，可用于后续快捷登录。' : '连接后可以使用 GitHub 账号直接登录。' }}
              </div>
            </div>
            <Button
              v-if="githubAccount"
              :loading="actionLoading['github-disconnect']"
              danger
              ghost
              @click="disconnectGithub"
            >
              解除绑定
            </Button>
            <Button v-else :loading="actionLoading['github-connect']" type="primary" @click="connectGithub">连接 GitHub</Button>
          </div>
        </Card>

      </div>

    </div>
  </Spin>

  <Modal
    v-model:open="needsReauth"
    cancel-text="取消"
    ok-text="继续"
    title="请再次验证密码"
    :confirm-loading="reauthLoading"
    @cancel="closeReauth"
    @ok="submitReauth"
  >
    <div class="space-y-4 pt-2">
      <div class="text-sm text-zinc-500 dark:text-zinc-400">出于安全考虑，此操作需要你先重新输入一次当前密码。</div>
      <Alert
        v-if="reauthErrors.non_field_errors?.length"
        :message="reauthErrors.non_field_errors[0]"
        show-icon
        type="error"
      />
      <div>
        <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">当前密码</div>
        <InputPassword v-model:value="reauthPassword" autocomplete="current-password" placeholder="请输入当前密码" />
        <div v-if="reauthErrors.password?.length" class="mt-2 text-sm text-rose-500">{{ reauthErrors.password[0] }}</div>
      </div>
    </div>
  </Modal>
</template>
