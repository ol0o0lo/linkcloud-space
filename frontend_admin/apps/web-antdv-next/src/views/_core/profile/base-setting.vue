<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { Alert, Button, Input, InputPassword, Modal, Select, Spin, Tag, message } from 'antdv-next';

import {
  changeAccountPhoneApi,
  parseAllauthErrors,
  reauthenticateApi,
  verifyPhoneApi,
} from '#/api/django/auth';
import {
  deleteCurrentUserAvatarApi,
  getCurrentUserApi,
  type UserRow,
  updateCurrentUserApi,
  uploadCurrentUserAvatarApi,
} from '#/api/django/resources';
import { useAuthStore } from '#/store';

type FieldErrors = Record<string, string[]>;
type PhoneWorkflowStep = 'input' | 'verify';

const emit = defineEmits<{
  editChange: [editing: boolean];
  profileUpdated: [];
}>();

const authStore = useAuthStore();

const loading = ref(false);
const saving = ref(false);
const avatarUploading = ref(false);
const avatarDeleting = ref(false);
const isEditing = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const profile = ref<null | UserRow>(null);
const form = ref({
  first_name: '',
  last_name: '',
  timezone: 'Asia/Shanghai',
});

const phoneWorkflowOpen = ref(false);
const phoneStep = ref<PhoneWorkflowStep>('input');
const phoneSubmitting = ref(false);
const phoneVerifying = ref(false);
const pendingPhone = ref('');
const phoneCode = ref('');
const phoneErrors = ref<FieldErrors>({});
const phoneForm = ref({
  phone: '',
});

const needsReauth = ref(false);
const reauthLoading = ref(false);
const reauthPassword = ref('');
const reauthErrors = ref<FieldErrors>({});
let pendingAction: null | (() => Promise<void>) = null;

function buildTimezoneOptions(currentTimezone = '') {
  const values = new Set<string>(currentTimezone ? [currentTimezone] : []);
  const supportedValuesOf = (Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  }).supportedValuesOf;

  if (typeof supportedValuesOf === 'function') {
    for (const timezone of supportedValuesOf('timeZone')) {
      values.add(timezone);
    }
  }
  return [...values].sort((left, right) => left.localeCompare(right)).map((value) => ({
    label: value,
    value,
  }));
}

const timezoneOptions = computed(() => buildTimezoneOptions(form.value.timezone));

const fullName = computed(() => {
  const current = profile.value;
  if (!current) return '';
  return [current.first_name, current.last_name].filter(Boolean).join(' ') || current.email || current.username;
});

const phoneStatus = computed(() => (profile.value?.phone_verified ? '已验证' : '未验证'));
const phoneActionLabel = computed(() => (profile.value?.phone ? '更换手机号' : '绑定手机号'));

function emitEditingState() {
  emit('editChange', isEditing.value || phoneWorkflowOpen.value);
}

function normalizePhone(phone: string) {
  return phone.trim().replace(/\s+/g, '');
}

function resetPhoneWorkflowState() {
  phoneWorkflowOpen.value = false;
  phoneStep.value = 'input';
  phoneSubmitting.value = false;
  phoneVerifying.value = false;
  pendingPhone.value = '';
  phoneCode.value = '';
  phoneErrors.value = {};
  phoneForm.value.phone = '';
}

function openPhoneWorkflow() {
  phoneWorkflowOpen.value = true;
  phoneStep.value = 'input';
  phoneErrors.value = {};
  phoneCode.value = '';
  pendingPhone.value = '';
  phoneForm.value.phone = '';
  emitEditingState();
}

function closePhoneWorkflow() {
  resetPhoneWorkflowState();
  closeReauth();
  emitEditingState();
}

function startEditing() {
  if (isEditing.value) return;
  isEditing.value = true;
  emitEditingState();
}

function resetEditingState() {
  if (profile.value) syncProfile(profile.value);
  isEditing.value = false;
}

function cancelEditing() {
  resetEditingState();
  emitEditingState();
}

function syncProfile(data: UserRow) {
  profile.value = data;
  form.value = {
    first_name: data.first_name || '',
    last_name: data.last_name || '',
    timezone: data.timezone || 'Asia/Shanghai',
  };
}

async function refreshProfile() {
  const data = await getCurrentUserApi();
  syncProfile(data);
}

async function loadData() {
  loading.value = true;
  try {
    await refreshProfile();
  } finally {
    loading.value = false;
  }
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
      reauthErrors.value = {};
      needsReauth.value = true;
      return false;
    }
    throw error;
  }
}

async function saveProfile() {
  if (!profile.value) return;
  saving.value = true;
  try {
    const data = await updateCurrentUserApi(profile.value.id, {
      first_name: form.value.first_name.trim(),
      last_name: form.value.last_name.trim(),
      timezone: form.value.timezone,
    });
    syncProfile(data);
    await authStore.fetchUserInfo();
    isEditing.value = false;
    emitEditingState();
    emit('profileUpdated');
    message.success('个人资料已更新');
  } finally {
    saving.value = false;
  }
}

function triggerAvatarSelect() {
  fileInputRef.value?.click();
}

async function handleAvatarChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = '';

  if (!file) return;

  avatarUploading.value = true;
  try {
    const result = await uploadCurrentUserAvatarApi(file);
    if (profile.value) {
      profile.value = {
        ...profile.value,
        avatar_url: result.avatar_url,
      };
    }
    await authStore.fetchUserInfo();
    emit('profileUpdated');
    message.success('头像已更新');
  } finally {
    avatarUploading.value = false;
  }
}

async function removeAvatar() {
  const currentProfile = profile.value;
  if (!currentProfile?.avatar_url) return;
  avatarDeleting.value = true;
  try {
    await deleteCurrentUserAvatarApi();
    profile.value = {
      ...currentProfile,
      avatar_url: null,
    };
    await authStore.fetchUserInfo();
    emit('profileUpdated');
    message.success('头像已移除');
  } finally {
    avatarDeleting.value = false;
  }
}

async function submitPhoneChange() {
  const normalizedPhone = normalizePhone(phoneForm.value.phone);
  if (!normalizedPhone) {
    phoneErrors.value = { phone: ['请输入新的手机号'] };
    return;
  }
  if (!/^\+\d{8,20}$/.test(normalizedPhone)) {
    phoneErrors.value = { phone: ['请输入带国家区号的手机号，例如 +8613800000000'] };
    return;
  }

  phoneErrors.value = {};
  phoneSubmitting.value = true;
  try {
    const completed = await runWithReauth(async () => {
      await changeAccountPhoneApi(normalizedPhone);
      pendingPhone.value = normalizedPhone;
      phoneStep.value = 'verify';
      phoneCode.value = '';
      message.success('验证码已发送到新手机号');
    });
    if (!completed) return;
  } catch (error: any) {
    phoneErrors.value = error?.data ? parseAllauthErrors(error.data) : { non_field_errors: ['发送验证码失败，请稍后重试。'] };
  } finally {
    phoneSubmitting.value = false;
  }
}

async function resendPhoneCode() {
  if (!pendingPhone.value) return;
  phoneErrors.value = {};
  phoneSubmitting.value = true;
  try {
    const completed = await runWithReauth(async () => {
      await changeAccountPhoneApi(pendingPhone.value);
      message.success('验证码已重新发送');
    });
    if (!completed) return;
  } catch (error: any) {
    phoneErrors.value = error?.data ? parseAllauthErrors(error.data) : { non_field_errors: ['重新发送失败，请稍后重试。'] };
  } finally {
    phoneSubmitting.value = false;
  }
}

function backToPhoneInput() {
  phoneStep.value = 'input';
  phoneCode.value = '';
  phoneErrors.value = {};
  phoneForm.value.phone = pendingPhone.value;
}

async function finalizePhoneChange() {
  await refreshProfile();
  await authStore.fetchUserInfo();
  resetPhoneWorkflowState();
  emitEditingState();
  emit('profileUpdated');
  message.success('手机号已更新');
}

async function submitPhoneVerification() {
  if (!phoneCode.value.trim()) {
    phoneErrors.value = { code: ['请输入短信验证码'] };
    return;
  }

  phoneErrors.value = {};
  phoneVerifying.value = true;
  try {
    await verifyPhoneApi(phoneCode.value.trim());
    await finalizePhoneChange();
  } catch (error: any) {
    if (error?.response?.status === 401) {
      try {
        await refreshProfile();
        if (profile.value?.phone === pendingPhone.value && profile.value?.phone_verified) {
          await finalizePhoneChange();
          return;
        }
      } catch {
        // Fall through to show the original verification error.
      }
    }
    phoneErrors.value = error?.data ? parseAllauthErrors(error.data) : { non_field_errors: ['验证码校验失败，请稍后重试。'] };
  } finally {
    phoneVerifying.value = false;
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
      try {
        await action();
      } catch (error: any) {
        phoneErrors.value = error?.data ? parseAllauthErrors(error.data) : { non_field_errors: ['操作失败，请稍后重试。'] };
        return;
      }
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

onMounted(async () => {
  await loadData();
});
</script>

<template>
  <Spin :spinning="loading">
    <input
      ref="fileInputRef"
      accept="image/*"
      class="hidden"
      type="file"
      @change="handleAvatarChange"
    >

    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div class="text-xl font-semibold text-zinc-950 dark:text-zinc-50">基本信息</div>
        <div class="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          默认先查看当前资料，点击编辑后再展开表单，完成后统一收口。
        </div>
      </div>

      <div class="flex w-full flex-wrap justify-end gap-3 sm:w-auto">
        <Button :loading="avatarUploading" @click="triggerAvatarSelect">上传头像</Button>
        <Button
          :disabled="!profile?.avatar_url"
          :loading="avatarDeleting"
          danger
          ghost
          @click="removeAvatar"
        >
          移除头像
        </Button>
        <Button v-if="!isEditing" class="w-full sm:w-auto" type="primary" @click="startEditing">
          编辑资料
        </Button>
        <template v-else>
          <Button class="w-full sm:w-auto" @click="cancelEditing">取消</Button>
          <Button :loading="saving" class="w-full sm:w-auto" type="primary" @click="saveProfile">保存资料</Button>
        </template>
      </div>
    </div>

    <div class="mt-6 rounded-[28px] border border-slate-200/80 bg-slate-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-900/40 sm:p-6">
      <div v-if="!isEditing" class="grid gap-4 md:grid-cols-2">
        <div class="rounded-2xl border border-white/90 bg-white px-5 py-4 dark:border-white/10 dark:bg-zinc-950/60">
          <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">姓名</div>
          <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">{{ fullName || '-' }}</div>
        </div>
        <div class="rounded-2xl border border-white/90 bg-white px-5 py-4 dark:border-white/10 dark:bg-zinc-950/60">
          <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">用户名</div>
          <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">{{ profile?.username || '-' }}</div>
        </div>
        <div class="rounded-2xl border border-white/90 bg-white px-5 py-4 dark:border-white/10 dark:bg-zinc-950/60">
          <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">邮箱</div>
          <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">{{ profile?.email || '-' }}</div>
        </div>
        <div class="rounded-2xl border border-white/90 bg-white px-5 py-4 dark:border-white/10 dark:bg-zinc-950/60">
          <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">手机号</div>
          <div class="mt-2 flex items-center gap-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">
            <span>{{ profile?.phone || '未绑定' }}</span>
            <Tag :color="profile?.phone_verified ? 'green' : 'gold'">{{ phoneStatus }}</Tag>
          </div>
        </div>
        <div class="rounded-2xl border border-white/90 bg-white px-5 py-4 dark:border-white/10 dark:bg-zinc-950/60">
          <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">时区</div>
          <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">{{ profile?.timezone || form.timezone }}</div>
        </div>
        <div class="rounded-2xl border border-white/90 bg-white px-5 py-4 dark:border-white/10 dark:bg-zinc-950/60">
          <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">资料状态</div>
          <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">{{ profile?.avatar_url ? '头像已设置' : '建议补充头像' }}</div>
        </div>
      </div>

      <div v-else class="space-y-6">
        <div class="rounded-2xl border border-white/90 bg-white px-5 py-4 dark:border-white/10 dark:bg-zinc-950/60">
          <div class="text-sm font-medium text-zinc-950 dark:text-zinc-50">账号信息</div>
          <div class="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <Tag color="blue">{{ profile?.username || 'anonymous' }}</Tag>
            <Tag>{{ profile?.email || '未设置邮箱' }}</Tag>
            <Tag :color="profile?.phone_verified ? 'green' : 'gold'">手机号{{ phoneStatus }}</Tag>
          </div>
        </div>

        <div class="grid gap-5 xl:grid-cols-2">
          <div>
            <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">姓</div>
            <Input v-model:value="form.first_name" placeholder="请输入姓氏" />
          </div>
          <div>
            <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">名</div>
            <Input v-model:value="form.last_name" placeholder="请输入名字" />
          </div>
          <div>
            <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">用户名</div>
            <Input :value="profile?.username" disabled />
          </div>
          <div>
            <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">邮箱</div>
            <Input :value="profile?.email || ''" disabled />
          </div>
          <div>
            <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">手机号</div>
            <Input :value="profile?.phone || '未绑定'" disabled />
          </div>
          <div>
            <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">时区</div>
            <Select
              v-model:value="form.timezone"
              :options="timezoneOptions"
              option-filter-prop="label"
              placeholder="请选择时区"
              show-search
            />
          </div>
        </div>
      </div>

    </div>

    <div class="mt-6 rounded-2xl border border-white/90 bg-white px-5 py-5 dark:border-white/10 dark:bg-zinc-950/60">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div class="text-sm font-semibold text-zinc-950 dark:text-zinc-50">手机号管理</div>
            <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              当前手机号用于登录验证和安全提醒，改绑时会先向新号码发送短信验证码确认。
            </div>
            <div class="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <Tag>{{ profile?.phone || '未绑定手机号' }}</Tag>
              <Tag :color="profile?.phone_verified ? 'green' : 'gold'">{{ phoneStatus }}</Tag>
            </div>
          </div>
          <Button type="primary" @click="openPhoneWorkflow">{{ phoneActionLabel }}</Button>
        </div>

        <div v-if="phoneWorkflowOpen" class="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
          <Alert
            v-if="phoneErrors.non_field_errors?.length"
            :message="phoneErrors.non_field_errors[0]"
            class="mb-4"
            show-icon
            type="error"
          />

          <template v-if="phoneStep === 'input'">
            <div class="text-sm text-zinc-600 dark:text-zinc-300">
              输入新的手机号后，系统会立即发送一条验证码短信到该号码。格式需要包含国家区号。
            </div>
            <div class="mt-4 max-w-md">
              <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">新手机号</div>
              <Input v-model:value="phoneForm.phone" placeholder="例如：+8613800000000" />
              <div v-if="phoneErrors.phone?.length" class="mt-2 text-sm text-rose-500">{{ phoneErrors.phone[0] }}</div>
            </div>
            <div class="mt-5 flex flex-wrap justify-end gap-3">
              <Button @click="closePhoneWorkflow">取消</Button>
              <Button :loading="phoneSubmitting" type="primary" @click="submitPhoneChange">发送验证码</Button>
            </div>
          </template>

          <template v-else>
            <div class="text-sm text-zinc-600 dark:text-zinc-300">
              验证码已发送到 <span class="font-medium text-zinc-900 dark:text-zinc-100">{{ pendingPhone }}</span>，输入短信验证码后即可完成改绑。
            </div>
            <div class="mt-4 max-w-md">
              <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">短信验证码</div>
              <Input v-model:value="phoneCode" autocomplete="one-time-code" placeholder="请输入短信验证码" />
              <div v-if="phoneErrors.code?.length" class="mt-2 text-sm text-rose-500">{{ phoneErrors.code[0] }}</div>
            </div>
            <div class="mt-5 flex flex-wrap justify-end gap-3">
              <Button @click="backToPhoneInput">修改号码</Button>
              <Button :loading="phoneSubmitting" @click="resendPhoneCode">重新发送验证码</Button>
              <Button :loading="phoneVerifying" type="primary" @click="submitPhoneVerification">确认更换</Button>
            </div>
          </template>
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
      <div class="text-sm text-zinc-500 dark:text-zinc-400">出于安全考虑，改绑手机号前需要你先重新输入一次当前密码。</div>
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
