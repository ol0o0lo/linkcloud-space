import { useMutation, useQuery } from '@tanstack/react-query';
import { Form, message } from 'antd';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type {
  NotificationDispatchManagementContext,
  NotificationDispatchTargetScope,
} from '@/services/manual/notificationDispatches';
import { listNotificationDispatchTargets } from '@/services/manual/notificationDispatches';
import { appsNotificationsApiCreateDispatch } from '@/services/openapi/notificationDispatches';
import { appsNotificationsApiListPreferences } from '@/services/openapi/notifications';
import {
  getDefaultScope,
  getRecipientSummary,
  getScopeOptions,
  isSupportedDispatchUrl,
  resolveEditorInitialValues,
  uniquePositiveIds,
} from './policy';
import type { CreateDispatchFormValues, DispatchSource } from './types';

type UseNotificationDispatchEditorParams = {
  open: boolean;
  isTenantMode: boolean;
  managementContext: NotificationDispatchManagementContext;
  currentOrganization?: { id: number; name: string };
  source?: DispatchSource;
  onCancel: () => void;
  onSuccess: () => void;
};

export function useNotificationDispatchEditor({
  open,
  isTenantMode,
  managementContext,
  currentOrganization,
  source,
  onCancel,
  onSuccess,
}: UseNotificationDispatchEditorParams) {
  const [form] = Form.useForm<CreateDispatchFormValues>();
  const [linkExpanded, setLinkExpanded] = useState(false);
  const [targetKeyword, setTargetKeyword] = useState('');
  const deferredTargetKeyword = useDeferredValue(targetKeyword.trim());
  const defaultScope = getDefaultScope(isTenantMode);
  const scopeValue = Form.useWatch('scope', form) || defaultScope;
  const recipientSummary = getRecipientSummary({
    scope: scopeValue,
    isTenantMode,
    organizationName: currentOrganization?.name,
  });
  const targetScope: NotificationDispatchTargetScope | undefined =
    scopeValue === 'platform' ? undefined : scopeValue;

  const categoryQuery = useQuery({
    queryKey: ['notification-dispatches', 'categories', managementContext],
    queryFn: () => appsNotificationsApiListPreferences(),
    enabled: open,
    staleTime: 10 * 60 * 1000,
  });
  const targetQuery = useQuery({
    queryKey: [
      'notification-dispatches',
      'targets',
      managementContext,
      currentOrganization?.id,
      scopeValue,
      deferredTargetKeyword,
    ],
    queryFn: () => {
      if (!targetScope) throw new Error('当前发送范围不需要选择目标。');
      return listNotificationDispatchTargets({
        scope: targetScope,
        management_context: managementContext,
        keyword: deferredTargetKeyword || undefined,
        page: 1,
        page_size: 50,
      });
    },
    enabled:
      open && recipientSummary.needsTargetSelection && Boolean(targetScope),
    staleTime: 30_000,
  });
  const createMutation = useMutation({
    mutationFn: (payload: API.NotificationDispatchIn) =>
      appsNotificationsApiCreateDispatch(
        { management_context: managementContext },
        payload,
      ),
    onSuccess: () => {
      message.success('通知已提交，正在分发');
      onSuccess();
    },
  });

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(resolveEditorInitialValues({ isTenantMode, source }));
    setLinkExpanded(Boolean(source?.url));
    setTargetKeyword('');
  }, [defaultScope, form, isTenantMode, open, source]);

  const targetOptions = useMemo(
    () =>
      (targetQuery.data?.items || []).map((item) => ({
        label: item.description
          ? `${item.label} · ${item.description}`
          : item.label,
        value: item.id,
      })),
    [targetQuery.data?.items],
  );
  const categoryOptions = useMemo(
    () =>
      (categoryQuery.data || []).map((item) => ({
        label: item.label,
        value: item.key,
      })),
    [categoryQuery.data],
  );
  const targetLabel =
    scopeValue === 'organization'
      ? '目标空间'
      : scopeValue === 'teams'
        ? '目标团队'
        : isTenantMode
          ? '接收成员'
          : '接收用户';
  const targetPlaceholder =
    scopeValue === 'organization'
      ? '输入空间名称或标识搜索'
      : scopeValue === 'teams'
        ? '输入团队名称搜索'
        : '输入姓名、用户名或邮箱搜索';

  const close = () => {
    if (createMutation.isPending) return;
    form.resetFields();
    setLinkExpanded(false);
    setTargetKeyword('');
    onCancel();
  };
  const submit = async () => {
    try {
      const values = await form.validateFields();
      let scopeIds: number[] = [];
      if (values.scope === 'organization' && isTenantMode) {
        if (!currentOrganization?.id) return;
        scopeIds = [currentOrganization.id];
      } else if (values.scope !== 'platform') {
        scopeIds = uniquePositiveIds(values.targets);
      }

      const payload: API.NotificationDispatchIn = {
        scope: values.scope,
        scope_ids: scopeIds,
        category: values.category?.trim() || '',
        title: values.title.trim(),
        body: values.body?.trim() || '',
        data: {},
      };
      if (values.url?.trim()) payload.url = values.url.trim();
      await createMutation.mutateAsync(payload);
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
    }
  };

  return {
    form,
    scopeOptions: getScopeOptions(isTenantMode),
    scopeValue,
    recipientSummary,
    targetLabel,
    targetPlaceholder,
    targetOptions,
    targetQuery,
    categoryOptions,
    isCategoryLoading: categoryQuery.isFetching,
    linkExpanded,
    isSubmitting: createMutation.isPending,
    onScopeChange: () => {
      form.setFieldValue('targets', []);
      setTargetKeyword('');
    },
    setLinkExpanded,
    setTargetKeyword,
    close,
    submit,
    isSupportedDispatchUrl,
  };
}

export type NotificationDispatchEditor = ReturnType<
  typeof useNotificationDispatchEditor
>;
