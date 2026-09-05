import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Spin, Switch, Typography } from 'antd';
import React, { useState } from 'react';
import {
  appsNotificationsApiListPreferences,
  appsNotificationsApiPatchPreference,
} from '@/services/openapi/notifications';

const notificationPreferenceKey = [
  'account-settings',
  'notification-preferences',
];

type PreferenceChannel = 'in_app' | 'email';

type PreferenceMutation = {
  category: string;
  channel: PreferenceChannel;
  checked: boolean;
};

function updatePreference(
  preferences: API.NotificationPreferenceOut[] | undefined,
  category: string,
  patch: Partial<Pick<API.NotificationPreferenceOut, PreferenceChannel>>,
) {
  return (preferences || []).map((item) =>
    item.key === category ? { ...item, ...patch } : item,
  );
}

const NotificationView: React.FC = () => {
  const queryClient = useQueryClient();
  const [saveError, setSaveError] = useState('');
  const preferencesQuery = useQuery({
    queryKey: notificationPreferenceKey,
    queryFn: () => appsNotificationsApiListPreferences(),
  });
  const preferenceMutation = useMutation({
    mutationFn: ({ category, channel, checked }: PreferenceMutation) =>
      appsNotificationsApiPatchPreference({ category }, { [channel]: checked }),
    onMutate: async ({ category, channel, checked }) => {
      setSaveError('');
      await queryClient.cancelQueries({ queryKey: notificationPreferenceKey });
      const previous = queryClient.getQueryData<
        API.NotificationPreferenceOut[]
      >(notificationPreferenceKey);
      queryClient.setQueryData<API.NotificationPreferenceOut[]>(
        notificationPreferenceKey,
        updatePreference(previous, category, { [channel]: checked }),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(
        notificationPreferenceKey,
        context?.previous || [],
      );
      setSaveError('通知偏好保存失败，请重试。');
    },
    onSuccess: (savedPreference) => {
      queryClient.setQueryData<API.NotificationPreferenceOut[]>(
        notificationPreferenceKey,
        (current) =>
          updatePreference(current, savedPreference.key, savedPreference),
      );
    },
  });

  if (preferencesQuery.isLoading) {
    return (
      <div className="flex min-h-32 items-center justify-center" role="status">
        <Spin description="正在加载通知偏好…" />
      </div>
    );
  }

  if (preferencesQuery.isError) {
    return (
      <Alert
        showIcon
        type="error"
        title="通知偏好加载失败"
        description="请检查网络后重新加载。"
        action={
          <Button onClick={() => void preferencesQuery.refetch()}>
            重新加载
          </Button>
        }
      />
    );
  }

  const preferences = preferencesQuery.data || [];

  if (!preferences.length) {
    return (
      <Typography.Text type="secondary">
        当前没有可配置的通知类别。
      </Typography.Text>
    );
  }

  const renderChannel = (
    item: API.NotificationPreferenceOut,
    channel: PreferenceChannel,
    label: string,
  ) => {
    const required = item.required_channels?.includes(channel) || false;
    return (
      <div className="flex min-w-24 items-center justify-between gap-2">
        <span>
          {label}
          {required ? (
            <Typography.Text type="secondary">（必选）</Typography.Text>
          ) : null}
        </span>
        <Switch
          aria-label={`${item.label}-${label}`}
          checked={required || item[channel]}
          disabled={required || preferenceMutation.isPending}
          loading={
            preferenceMutation.isPending &&
            preferenceMutation.variables?.category === item.key &&
            preferenceMutation.variables.channel === channel
          }
          onChange={(checked) =>
            preferenceMutation.mutate({
              category: item.key,
              channel,
              checked,
            })
          }
        />
      </div>
    );
  };

  return (
    <div>
      {saveError ? (
        <Alert
          className="mb-3"
          closable
          showIcon
          type="error"
          title={saveError}
          onClose={() => setSaveError('')}
        />
      ) : null}
      <div className="divide-y divide-gray-100">
        {preferences.map((item) => (
          <div
            className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between"
            key={item.key}
          >
            <div className="min-w-0">
              <Typography.Text strong>{item.label}</Typography.Text>
              <div>
                <Typography.Text type="secondary">
                  {item.description || '按需选择接收渠道。'}
                </Typography.Text>
              </div>
            </div>
            <div className="flex flex-wrap gap-6">
              {renderChannel(item, 'in_app', '站内信')}
              {renderChannel(item, 'email', '邮件')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationView;
