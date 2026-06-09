<script setup>
import { onMounted, ref } from 'vue';

import AccountLayout from '@/layouts/AccountLayout.vue';
import FormErrors from '@/accounts/components/FormErrors.vue';
import { get } from '@/utils/api';

const loading = ref(true);
const summary = ref(null);
const records = ref([]);
const errors = ref({});

async function loadReferralData() {
  loading.value = true;
  errors.value = {};
  try {
    summary.value = await get('/api/referrals/me/summary/');
    const data = await get('/api/referrals/me/records/');
    records.value = data.items || [];
  } catch {
    errors.value = { non_field_errors: ['无法加载推广数据，请稍后重试。'] };
  } finally {
    loading.value = false;
  }
}

onMounted(loadReferralData);
</script>

<template>
  <AccountLayout wide>
    <div class="space-y-6">
      <div class="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-lime-50 p-6 shadow-sm">
        <p class="text-sm font-medium uppercase tracking-[0.2em] text-emerald-600">Referral Center</p>
        <h2 class="mt-2 text-3xl font-semibold text-slate-900">邀请注册推广</h2>
        <p class="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          分享你的专属邀请入口。新用户注册成功后会生成邀请记录，完成实名认证并审核通过后发放奖励。
        </p>

        <div
          v-if="summary"
          class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        >
          <div class="rounded-2xl bg-white/80 p-4 ring-1 ring-emerald-100">
            <div class="text-xs uppercase tracking-wide text-slate-500">邀请码</div>
            <div class="mt-2 text-lg font-semibold text-slate-900">{{ summary.invite_code }}</div>
          </div>
          <div class="rounded-2xl bg-white/80 p-4 ring-1 ring-emerald-100">
            <div class="text-xs uppercase tracking-wide text-slate-500">已注册</div>
            <div class="mt-2 text-lg font-semibold text-slate-900">{{ summary.registered_count }}</div>
          </div>
          <div class="rounded-2xl bg-white/80 p-4 ring-1 ring-emerald-100">
            <div class="text-xs uppercase tracking-wide text-slate-500">待审核</div>
            <div class="mt-2 text-lg font-semibold text-slate-900">{{ summary.pending_review_count }}</div>
          </div>
          <div class="rounded-2xl bg-white/80 p-4 ring-1 ring-emerald-100">
            <div class="text-xs uppercase tracking-wide text-slate-500">已发奖</div>
            <div class="mt-2 text-lg font-semibold text-slate-900">{{ summary.rewarded_count }}</div>
          </div>
        </div>

        <div
          v-if="summary"
          class="mt-5 rounded-2xl border border-dashed border-emerald-200 bg-white/70 p-4"
        >
          <div class="text-xs uppercase tracking-wide text-slate-500">分享链接</div>
          <div class="mt-2 break-all font-mono text-sm text-slate-700">{{ summary.share_link }}</div>
        </div>
      </div>

      <div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h3 class="text-lg font-semibold text-slate-900">邀请记录</h3>
            <p class="mt-1 text-sm text-slate-500">这里会展示被邀请用户的脱敏信息和当前进度。</p>
          </div>
          <button
            type="button"
            class="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            @click="loadReferralData"
          >
            刷新
          </button>
        </div>

        <FormErrors
          class="mt-4"
          :errors="errors.non_field_errors || []"
        />

        <div
          v-if="loading"
          class="mt-6 text-sm text-slate-500"
        >
          正在加载推广数据...
        </div>

        <div
          v-else-if="records.length === 0"
          class="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500"
        >
          还没有邀请记录，先把邀请码分享给你的朋友吧。
        </div>

        <div
          v-else
          class="mt-6 overflow-hidden rounded-2xl border border-slate-200"
        >
          <table class="min-w-full divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50 text-left text-slate-500">
              <tr>
                <th class="px-4 py-3 font-medium">被邀请人</th>
                <th class="px-4 py-3 font-medium">状态</th>
                <th class="px-4 py-3 font-medium">创建时间</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white text-slate-700">
              <tr
                v-for="record in records"
                :key="record.id"
              >
                <td class="px-4 py-3">{{ record.invitee_display }}</td>
                <td class="px-4 py-3">
                  <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {{ record.status }}
                  </span>
                </td>
                <td class="px-4 py-3">{{ new Date(record.created_at).toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </AccountLayout>
</template>
