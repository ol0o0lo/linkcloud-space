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

const showPasskeys = ref(false);
const newPasskeyName = ref('');
const passwordless = ref(true);
const passkeyErrors = ref<FieldErrors>({});
const supported = ref(true);

const needsReauth = ref(false);
const reauthLoading = ref(false);
const reauthPassword = ref('');
const reauthErrors = ref<FieldErrors>({});
let pendingAction: null | (() => Promise<void>) = null;

const totp = computed(() => authenticators.value.find((item) => item.type === 'totp') ?? null);
const recoveryAuthenticator = computed(() => authenticators.value.find((item) => item.type === 'recovery_codes') ?? null);
const passkeys = computed(() => authenticators.value.filter((item) => item.type === 'webauthn'));
const githubAccount = computed(() => socialAccounts.value.find((item) => item.provider?.id === 'github') ?? null);

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

async function runWithReauth(action: () => Promise<void>) {
  try {
    await action();
    return true;
  } catch (error: any) {
    if (isReauthRequired(error)) {
      pendingAction = action;
      needsReauth.value = true;
      return false;
    }
    throw error;
  }
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

    if (passkeys.value.length > 0) {
      showPasskeys.value = true;
    }

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
    const completed = await runWithReauth(async () => {
      await activateTotpApi(totpCode.value.trim());
    });
    if (!completed) return;

    totpCode.value = '';
    message.success('验证器已启用');
    await loadSecurityData();
  } catch (error: any) {
    totpErrors.value = error?.data ? parseAllauthErrors(error.data) : { non_field_errors: ['启用验证器失败，请稍后重试。'] };
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
        const completed = await runWithReauth(async () => {
          await deactivateTotpApi();
        });
        if (!completed) return;

        showRecoveryCodes.value = false;
        recoveryCodes.value = [];
        recoveryUnused.value = [];
        recoveryTotal.value = 0;
        message.success('验证器已关闭');
        await loadSecurityData();
      } finally {
        setActionLoading('totp-disable', false);
      }
    },
  });
}

async function loadRecoveryCodes() {
  setActionLoading('recovery', true);
  try {
    const completed = await runWithReauth(async () => {
      const data = await listRecoveryCodesApi();
      const payload = unwrapAllauthData<RecoveryCodesRow>(data) || {};
      recoveryCodes.value = payload.unused_codes || payload.codes || [];
      recoveryUnused.value = payload.unused_codes || [];
      recoveryTotal.value = payload.total_code_count || recoveryCodes.value.length;
      showRecoveryCodes.value = true;
    });
    if (!completed) return;
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
        const completed = await runWithReauth(async () => {
          await regenerateRecoveryCodesApi();
        });
        if (!completed) return;

        message.success('恢复码已重新生成');
        await loadRecoveryCodes();
        await loadSecurityData();
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
    const completed = await runWithReauth(async () => {
      const data = await beginAddPasskeyApi(passwordless.value);
      const payload = unwrapAllauthData<any>(data);
      const options = payload?.creation_options ?? payload;
      const credential = await createPasskeyCredential(options);
      await addPasskeyApi(newPasskeyName.value.trim() || 'Passkey', credential);
    });
    if (!completed) return;

    newPasskeyName.value = '';
    showPasskeys.value = true;
    message.success('Passkey 已添加');
    await loadSecurityData();
  } catch (error: any) {
    if (error?.name === 'AbortError' || error?.name === 'NotAllowedError') {
      return;
    }
    passkeyErrors.value = error?.data
      ? parseAllauthErrors(error.data)
      : { non_field_errors: [error?.message || '添加 Passkey 失败，请稍后重试。'] };
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
    const completed = await runWithReauth(async () => {
      await renamePasskeyApi(passkey.id as number, name);
    });
    if (!completed) return;

    message.success('Passkey 名称已更新');
    await loadSecurityData();
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
        const completed = await runWithReauth(async () => {
          await removePasskeyApi(passkey.id as number);
        });
        if (!completed) return;

        message.success('Passkey 已移除');
        await loadSecurityData();
      } finally {
        setActionLoading(`passkey-remove-${passkey.id}`, false);
      }
    },
  });
}

async function connectGithub() {
  setActionLoading('github-connect', true);
  try {
    const callbackUrl = `${window.location.origin}/dashboard/account/social/callback?next=${encodeURIComponent('/profile?tab=security')}`;
    await redirectProviderConnect('github', callbackUrl);
  } catch {
    setActionLoading('github-connect', false);
  }
}

async function disconnectGithub() {
  if (!githubAccount.value) return;

  setActionLoading('github-disconnect', true);
  try {
    const completed = await runWithReauth(async () => {
      await disconnectSocialApi('github', githubAccount.value?.uid || '');
    });
    if (!completed) return;

    message.success('GitHub 绑定已解除');
    await loadSecurityData();
  } finally {
    setActionLoading('github-disconnect', false);
  }
}

async function submitReauth() {
  reauthErrors.value = {};
  reauthLoading.value = true;
  try {
    await reauthenticateApi(reauthPassword.value);
    needsReauth.value = false;
    reauthPassword.value = '';
    const action = pendingAction;
    pendingAction = null;
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
    <div class="space-y-6">
      <Card :bordered="false" class="shadow-sm">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">验证器应用 (TOTP)</div>
            <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              和旧账户中心保持同一套 allauth MFA 数据，启用后登录时会要求输入动态验证码。
            </div>
          </div>
          <Tag :color="totp ? 'green' : 'default'">{{ totp ? '已启用' : '未启用' }}</Tag>
        </div>

        <div v-if="totp" class="mt-5 flex flex-wrap items-center gap-3">
          <Button :loading="actionLoading['totp-disable']" danger @click="disableTotp">关闭验证器</Button>
          <span class="text-sm text-zinc-500 dark:text-zinc-400">恢复码会继续保留，建议在关闭前确认是否已经备份。</span>
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
      </Card>

      <Card :bordered="false" class="shadow-sm">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">恢复码</div>
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
      </Card>

      <Card :bordered="false" class="shadow-sm">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">Passkeys</div>
            <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              支持 Touch ID、Windows Hello、手机或硬件安全密钥，和旧前端账户页共享同一批 Passkey 数据。
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

        <div class="mt-5 flex flex-wrap gap-3">
          <Button @click="showPasskeys = !showPasskeys">{{ showPasskeys ? '收起详情' : '管理 Passkey' }}</Button>
        </div>

        <div v-if="showPasskeys" class="mt-5 space-y-5">
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

      <Card :bordered="false" class="shadow-sm">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">GitHub 绑定</div>
            <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              迁移后这里直接替代旧账户页的 GitHub 连接能力，用于一键登录和账户关联。
            </div>
          </div>
          <Tag :color="githubAccount ? 'green' : 'default'">{{ githubAccount ? '已连接' : '未连接' }}</Tag>
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
