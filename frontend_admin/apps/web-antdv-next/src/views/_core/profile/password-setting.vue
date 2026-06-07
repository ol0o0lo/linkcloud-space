<script setup lang="ts">
import { ref } from 'vue';

import { Alert, Button, Card, InputPassword, message } from 'antdv-next';

import { changePasswordApi, parseAllauthErrors } from '#/api/django/auth';

const submitting = ref(false);
const form = ref({
  confirm_password: '',
  current_password: '',
  new_password: '',
});
const errors = ref<Record<string, string[]>>({});

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
    <div class="mb-6">
      <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">修改密码</div>
      <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        这里直接接入 allauth 的密码修改接口，修改后浏览器会继续保持当前登录状态。
      </div>
    </div>

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

    <div class="mt-6 flex justify-end">
      <Button :loading="submitting" type="primary" @click="submit">更新密码</Button>
    </div>
  </Card>
</template>
