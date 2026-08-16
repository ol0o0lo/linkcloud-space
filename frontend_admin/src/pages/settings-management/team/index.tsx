import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Form, Popconfirm, Select, Space, Tabs, Typography } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { wrapTextStyle } from '@/pages/_shared/adminLayout';
import {
  appsSettingsApiDeleteTeamSettingView,
  appsSettingsApiListTeamSettings,
  appsSettingsApiPutTeamSetting,
} from '@/services/openapi/teamSettings';
import { appsTeamsApiListTeams } from '@/services/openapi/teams';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/space/shared';
import {
  PublishRulesControl,
  SettingSchemaControl,
  buildSettingSections,
  initialDraftValue,
  parseSettingValue,
  publishRulesSettingKey,
  settingAnchorId,
  settingsManagementQueryKeys,
} from '../shared';

type DraftValues = Record<string, unknown>;

const settingRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  alignItems: 'flex-start',
  padding: '18px 0',
  borderTop: '1px solid var(--ant-color-border-secondary)',
  flexWrap: 'wrap',
};
const settingMetaStyle: React.CSSProperties = { flex: '0 0 240px', minWidth: 200 };
const settingControlStyle: React.CSSProperties = { flex: '1 1 320px', minWidth: 280 };

const TeamSettingsPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [selectedTeamId, setSelectedTeamId] = useState<number>();
  const [activeCategory, setActiveCategory] = useState<string>();
  const [draftValues, setDraftValues] = useState<DraftValues>({});

  const teamsQuery = useQuery({
    queryKey: settingsManagementQueryKeys.teams(workspace.selectedOrgSlug),
    queryFn: () => appsTeamsApiListTeams({ page: 1, page_size: 100 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  React.useEffect(() => {
    const firstTeamId = teamsQuery.data?.items?.[0]?.id;
    if (!selectedTeamId && firstTeamId) {
      setSelectedTeamId(firstTeamId);
    }
  }, [selectedTeamId, teamsQuery.data]);

  const settingsQuery = useQuery({
    queryKey: settingsManagementQueryKeys.team(workspace.selectedOrgSlug, selectedTeamId),
    queryFn: () => appsSettingsApiListTeamSettings({ team_id: selectedTeamId! }),
    enabled: Boolean(workspace.selectedOrgSlug && selectedTeamId),
  });

  const updateMutation = useMutation({
    mutationFn: ({ setting, value }: { setting: API.SettingOut; value: unknown }) =>
      appsSettingsApiPutTeamSetting({ team_id: selectedTeamId!, key: setting.key }, { value: parseSettingValue(value, setting.value_type) }),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({ queryKey: settingsManagementQueryKeys.team(workspace.selectedOrgSlug, selectedTeamId) });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (setting: API.SettingOut) => appsSettingsApiDeleteTeamSettingView({ team_id: selectedTeamId!, key: setting.key }),
    onSuccess: async () => {
      await workspace.queryClient.invalidateQueries({ queryKey: settingsManagementQueryKeys.team(workspace.selectedOrgSlug, selectedTeamId) });
    },
  });

  const sections = useMemo(() => buildSettingSections(settingsQuery.data), [settingsQuery.data]);

  useEffect(() => {
    setDraftValues({});
    setActiveCategory(undefined);
  }, [workspace.selectedOrgSlug, selectedTeamId]);

  useEffect(() => {
    if (sections.length > 0 && !sections.some((section) => section.category === activeCategory)) {
      setActiveCategory(sections[0].category);
    }
  }, [activeCategory, sections]);

  useEffect(() => {
    setDraftValues((currentValues) => {
      const nextDrafts = { ...currentValues };
      (settingsQuery.data || []).forEach((setting) => {
        if (!(setting.key in nextDrafts)) {
          nextDrafts[setting.key] = initialDraftValue(setting);
        }
      });
      return nextDrafts;
    });
  }, [settingsQuery.data]);

  const renderControl = (setting: API.SettingOut) => {
    const value = draftValues[setting.key];
    const onChange = (nextValue: unknown) => setDraftValues((values) => ({ ...values, [setting.key]: nextValue }));
    const onCommit = (nextValue: unknown) => {
      setDraftValues((values) => ({ ...values, [setting.key]: nextValue }));
      updateMutation.mutate({ setting, value: nextValue });
    };

    if (setting.key === publishRulesSettingKey) {
      return <PublishRulesControl value={value} onCommit={onCommit} />;
    }

    return <SettingSchemaControl setting={setting} value={value} onChange={onChange} onCommit={onCommit} />;
  };

  return (
    <TenantSelectionGuard
      title="团队设置"
      extra={
        <Space size={8}>
          <Typography.Text type="secondary">选择团队</Typography.Text>
          <Select
            aria-label="团队"
            loading={teamsQuery.isLoading}
            options={(teamsQuery.data?.items || []).map((team) => ({ label: team.name, value: team.id }))}
            placeholder="选择团队"
            value={selectedTeamId}
            onChange={(value) => {
              setSelectedTeamId(value);
            }}
            style={{ width: 320, maxWidth: '100%' }}
          />
        </Space>
      }
    >
      <Card loading={settingsQuery.isLoading}>
        <Tabs
          tabPlacement="start"
          activeKey={activeCategory || sections[0]?.category}
          onChange={setActiveCategory}
          items={sections.map((section) => ({
            key: section.category,
            label: section.title,
            children: (
              <div style={{ paddingLeft: 8 }}>
                {section.rows.map((setting, settingIndex) => {
                  const title = setting.label || setting.key;
                  const description = setting.key !== publishRulesSettingKey && setting.description && setting.description !== title ? setting.description : undefined;

                  return (
                    <div key={setting.key} id={settingAnchorId(setting.key)} style={{ ...settingRowStyle, borderTop: settingIndex === 0 ? 0 : settingRowStyle.borderTop }}>
                      <Space orientation="vertical" size={4} style={settingMetaStyle}>
                        <Space wrap align="center">
                          <Typography.Text strong>{title}</Typography.Text>
                          {setting.is_customized ? (
                            <Popconfirm title="确认恢复该设置默认值？" onConfirm={() => restoreMutation.mutate(setting)}>
                              <Button type="link" size="small" style={{ paddingInline: 0 }}>
                                恢复默认
                              </Button>
                            </Popconfirm>
                          ) : null}
                        </Space>
                        {description ? (
                          <Typography.Text type="secondary" style={wrapTextStyle}>
                            {description}
                          </Typography.Text>
                        ) : null}
                      </Space>
                      <Form layout="vertical" style={{ ...settingControlStyle, maxWidth: setting.value_type === 'json' ? 900 : 520 }}>
                        <Form.Item style={{ marginBottom: 0 }}>{renderControl(setting)}</Form.Item>
                      </Form>
                    </div>
                  );
                })}
              </div>
            ),
          }))}
        />
      </Card>
    </TenantSelectionGuard>
  );
};

export default TeamSettingsPage;
