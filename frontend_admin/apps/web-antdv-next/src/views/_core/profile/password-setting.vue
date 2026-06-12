<script setup lang="ts">
import { ref } from 'vue';

import { Alert, Button, Card, InputPassword, message } from 'antdv-next';

import { changePasswordApi, parseAllauthErrors } from '#/api/django/auth';

const emit = defineEmits<{
  editChange: [editing: boolean];
  statusChange: [];
}>();

const isEditing = ref(false);
const submitting = ref(false);
const form = ref({
  confirm_password: '',
  current_password: '',
  new_password: '',
});
const errors = ref<Record<string, string[]>>({});

function startEditing() {
  isEditing.value = true;
  emit('editChange', true);
}

function cancelEditing() {
  resetForm();
  errors.value = {};
  isEditing.value = false;
  emit('editChange', false);
}

function resetForm() {
  form.value = {
    confirm_password: '',
    current_password: '',
    new_password: '',
  };
}

async function submit() {
  errors.value = {};

  if (form.value.new_password !== form.value.confirm_password) {
    errors.value = {
      confirm_password: ['两次输入的新密码不一致'],
    };
    return;
  }

  submitting.value = true;
  try {
    await changePasswordApi({
      current_password: form.value.current_password,
      new_password: form.value.new_password,
    });
    resetForm();
    isEditing.value = false;
    emit('editChange', false);
    emit('statusChange');
    message.success('登录密码已更新');
  } catch (error: any) {
    errors.value = error?.data ? parseAllauthErrors(error.data) : { non_field_errors: ['密码修改失败，请稍后重试。'] };
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Card :bordered="false" class="max-w-3xl shadow-sm">
    <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">密码安全</div>
        <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          默认保持摘要查看，只有在需要更新登录凭据时才展开编辑表单。
        </div>
      </div>

      <div class="flex w-full flex-wrap justify-end gap-3 sm:w-auto">
        <Button v-if="!isEditing" class="w-full sm:w-auto" type="primary" @click="startEditing">
          修改密码
        </Button>
        <template v-else>
          <Button class="w-full sm:w-auto" @click="cancelEditing">取消</Button>
          <Button :loading="submitting" class="w-full sm:w-auto" type="primary" @click="submit">更新密码</Button>
        </template>
      </div>
    </div>

    <div v-if="!isEditing" class="grid gap-4 md:grid-cols-2">
      <div class="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">密码状态</div>
        <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">登录密码已设置，可按需更新</div>
      </div>
      <div class="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">会话策略</div>
        <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">修改后继续保留当前设备登录</div>
      </div>
    </div>

    <template v-else>
      <Alert
        v-if="errors.non_field_errors?.length"
        :message="errors.non_field_errors[0]"
        class="mb-4"
        show-icon
        type="error"
      />

      <div class="space-y-5">
        <div>
          <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">当前密码</div>
          <InputPassword v-model:value="form.current_password" autocomplete="current-password" placeholder="请输入当前密码" />
          <div v-if="errors.current_password?.length" class="mt-2 text-sm text-rose-500">
            {{ errors.current_password[0] }}
          </div>
        </div>

        <div>
          <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">新密码</div>
          <InputPassword v-model:value="form.new_password" autocomplete="new-password" placeholder="请输入新密码" />
          <div v-if="(errors.new_password || errors.password || errors.password1)?.length" class="mt-2 text-sm text-rose-500">
            {{ (errors.new_password || errors.password || errors.password1 || [])[0] }}
          </div>
        </div>

        <div>
          <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">确认新密码</div>
          <InputPassword v-model:value="form.confirm_password" autocomplete="new-password" placeholder="请再次输入新密码" />
          <div v-if="(errors.confirm_password || errors.new_password2 || errors.password2)?.length" class="mt-2 text-sm text-rose-500">
            {{ (errors.confirm_password || errors.new_password2 || errors.password2 || [])[0] }}
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>
