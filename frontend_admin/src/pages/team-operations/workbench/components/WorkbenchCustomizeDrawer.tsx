import {
  AppstoreOutlined,
  BarChartOutlined,
  BranchesOutlined,
  CloudUploadOutlined,
  FlagOutlined,
  NotificationOutlined,
  PieChartOutlined,
  UnorderedListOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Drawer, Segmented, Switch, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  WORKBENCH_WIDTH_LABELS,
  type WorkbenchLayoutPreference,
  type WorkbenchWidgetDefinition,
  type WorkbenchWidgetWidth,
} from '../layout/model';
import { useStyles } from '../styles';

type WorkbenchCustomizeDrawerProps = {
  open: boolean;
  mobile?: boolean;
  definitions: readonly WorkbenchWidgetDefinition[];
  layout: WorkbenchLayoutPreference;
  onClose: () => void;
  onVisibilityChange: (widgetId: string, visible: boolean) => void;
  onWidthChange: (widgetId: string, width: WorkbenchWidgetWidth) => void;
};

const widgetSettingIcons: Record<string, ReactNode> = {
  'mine-summary': <UnorderedListOutlined />,
  'mine-priority': <FlagOutlined />,
  'mine-progress': <PieChartOutlined />,
  'mine-announcements': <NotificationOutlined />,
  'mine-quick-actions': <AppstoreOutlined />,
  'space-overview': <BarChartOutlined />,
  'space-publish': <CloudUploadOutlined />,
  'space-risks': <WarningOutlined />,
  'space-workflow': <BranchesOutlined />,
  'space-quick-actions': <AppstoreOutlined />,
};

export function WorkbenchCustomizeDrawer({
  open,
  mobile,
  definitions,
  layout,
  onClose,
  onVisibilityChange,
  onWidthChange,
}: WorkbenchCustomizeDrawerProps) {
  const { styles } = useStyles();
  const [validationError, setValidationError] = useState<string>();
  const preferences = useMemo(
    () => new Map(layout.map((item) => [item.id, item])),
    [layout],
  );
  const visibleCount = layout.filter((item) => item.visible).length;

  return (
    <Drawer
      open={open}
      placement={mobile ? 'bottom' : 'right'}
      size={mobile ? 420 : 380}
      title="组件管理"
      mask={false}
      className={styles.widgetCustomizeDrawer}
      onClose={onClose}
    >
      <div
        data-testid="workbench-customize-drawer"
        data-mobile={mobile || undefined}
      >
        <Typography.Paragraph type="secondary">
          {mobile
            ? '移动端仅调整组件显示状态'
            : '控制组件显隐与桌面宽度，排序请在工作台中直接拖动。'}
        </Typography.Paragraph>
        <Typography.Text className={styles.widgetSettingsCount}>
          {`${visibleCount} / ${definitions.length} 个组件显示`}
        </Typography.Text>
        {validationError ? (
          <Typography.Paragraph type="danger" role="alert">
            {validationError}
          </Typography.Paragraph>
        ) : null}
        <div className={styles.widgetSettingsList}>
          {definitions.map((definition) => {
            const preference = preferences.get(definition.id) || {
              id: definition.id,
              width: definition.defaultWidth,
              visible: definition.defaultVisible,
            };
            return (
              <div
                key={definition.id}
                data-testid={`widget-setting-${definition.id}`}
                className={styles.widgetSettingItem}
              >
                <div className={styles.widgetSettingHeader}>
                  <Typography.Text strong className={styles.widgetSettingTitle}>
                    <span
                      className={styles.widgetSettingIcon}
                      aria-hidden="true"
                    >
                      {widgetSettingIcons[definition.id] || (
                        <AppstoreOutlined />
                      )}
                    </span>
                    {definition.title}
                  </Typography.Text>
                  <Switch
                    aria-label={`显示 ${definition.title}`}
                    checked={preference.visible}
                    onChange={(visible) => {
                      if (!visible && visibleCount <= 1) {
                        setValidationError('工作台至少需要保留一个组件');
                        return;
                      }
                      setValidationError(undefined);
                      onVisibilityChange(definition.id, visible);
                    }}
                  />
                </div>
                {!mobile ? (
                  <div className={styles.widgetSettingWidth}>
                    <Typography.Text type="secondary">桌面宽度</Typography.Text>
                    <Segmented
                      size="small"
                      value={preference.width}
                      disabled={!preference.visible}
                      options={definition.allowedWidths.map((width) => ({
                        value: width,
                        label: WORKBENCH_WIDTH_LABELS[width],
                      }))}
                      onChange={(value) =>
                        onWidthChange(
                          definition.id,
                          value as WorkbenchWidgetWidth,
                        )
                      }
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </Drawer>
  );
}
