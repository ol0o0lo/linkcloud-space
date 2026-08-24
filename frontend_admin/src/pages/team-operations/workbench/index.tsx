import {
  ApartmentOutlined,
  EllipsisOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { history, useLocation, useModel } from '@umijs/max';
import {
  Alert,
  Button,
  Grid,
  message,
  Segmented,
  Space,
  Spin,
  Tooltip,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useState } from 'react';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/space/shared';
import { WorkbenchCustomizeDrawer } from './components/WorkbenchCustomizeDrawer';
import { WorkbenchEditToolbar } from './components/WorkbenchEditToolbar';
import { useUnsavedWorkbenchGuard } from './hooks/useUnsavedWorkbenchGuard';
import { useWorkbenchLayoutPreference } from './hooks/useWorkbenchLayoutPreference';
import type { WorkbenchWidgetWidth } from './layout/model';
import { setWidgetVisibility, updateWidgetWidth } from './layout/normalize';
import { reorderWorkbenchWidgets } from './layout/reorder';
import { MineWorkbenchContent } from './MineWorkbenchContent';
import { mineWidgetDefinitions, spaceWidgetDefinitions } from './registry';
import { SpaceWorkbenchContent } from './SpaceWorkbenchContent';
import { useStyles } from './styles';
import {
  buildWorkbenchViewLocation,
  canAccessSpaceWorkbench,
  getWorkbenchViewFromSearch,
  type WorkbenchView,
} from './view';

type WorkbenchDataStatus = {
  isFetching: boolean;
  updatedAt: string | null;
};

const TeamOperationsWorkbenchPage: React.FC = () => {
  const { styles } = useStyles();
  const screens = Grid.useBreakpoint();
  const mobile = !screens.md;
  const workspace = useTenantWorkspace();
  const location = useLocation();
  const { initialState } = useModel('@@initialState');
  const requestedView = getWorkbenchViewFromSearch(location.search);
  const canViewSpaceWorkbench = canAccessSpaceWorkbench(
    initialState?.teamOperationsCapabilities,
  );
  const activeView: WorkbenchView =
    requestedView === 'space' && canViewSpaceWorkbench ? 'space' : 'mine';
  const definitions =
    activeView === 'mine' ? mineWidgetDefinitions : spaceWidgetDefinitions;
  const layout = useWorkbenchLayoutPreference(activeView, definitions);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dataStatusByView, setDataStatusByView] = useState<
    Record<WorkbenchView, WorkbenchDataStatus>
  >({
    mine: { isFetching: false, updatedAt: null },
    space: { isFetching: false, updatedAt: null },
  });
  const activeDataStatus = dataStatusByView[activeView];
  const organizationName =
    workspace.selectedOrganization?.name || workspace.selectedOrgSlug;
  const viewLabel = activeView === 'mine' ? '我的工作台' : '空间工作台';
  const customizationLabel = layout.isEditing ? '组件管理' : '自定义工作台';

  useUnsavedWorkbenchGuard(layout.isEditing && layout.isDirty);

  useEffect(() => {
    if (!layout.isEditing) {
      setDrawerOpen(false);
    }
  }, [layout.isEditing]);

  useEffect(() => {
    if (requestedView !== 'space' || canViewSpaceWorkbench) return;
    history.replace(
      buildWorkbenchViewLocation(location.pathname, location.search, 'mine'),
    );
  }, [
    canViewSpaceWorkbench,
    location.pathname,
    location.search,
    requestedView,
  ]);

  const updateDataStatus = useCallback(
    (view: WorkbenchView, isFetching: boolean, updatedAt: string | null) => {
      setDataStatusByView((current) => {
        const previous = current[view];
        if (
          previous.isFetching === isFetching &&
          previous.updatedAt === updatedAt
        ) {
          return current;
        }
        return { ...current, [view]: { isFetching, updatedAt } };
      });
    },
    [],
  );

  const changeView = (value: string | number) => {
    const view = String(value);
    if (view !== 'mine' && view !== 'space') return;
    history.push(
      buildWorkbenchViewLocation(location.pathname, location.search, view),
    );
  };

  const openCustomization = () => {
    if (!layout.isEditing) {
      layout.beginEditing();
    }
    setDrawerOpen(true);
  };

  const changeVisibility = (widgetId: string, visible: boolean) => {
    layout.setDraft((current) =>
      setWidgetVisibility(current, widgetId, visible),
    );
  };

  const changeWidth = (widgetId: string, width: WorkbenchWidgetWidth) => {
    layout.setDraft((current) =>
      updateWidgetWidth(current, widgetId, width, definitions),
    );
  };

  const reorder = (activeId: string, overId: string) => {
    layout.setDraft((current) =>
      reorderWorkbenchWidgets(current, activeId, overId),
    );
  };

  const cancelEditing = () => {
    layout.cancelEditing();
    setDrawerOpen(false);
  };

  const saveLayout = () => {
    void layout
      .save()
      .then(() => {
        setDrawerOpen(false);
        message.success('工作台布局已保存');
      })
      .catch(() => {
        message.error('工作台布局保存失败，请稍后重试');
      });
  };

  return (
    <TenantSelectionGuard title="工作概览">
      <div className={styles.page}>
        <header
          className={styles.commandHeader}
          data-testid="workbench-command-header"
          data-editing={layout.isEditing || undefined}
        >
          <div className={styles.commandHeaderCopy}>
            <span className={styles.commandEyebrow}>
              <span className={styles.commandLiveDot} aria-hidden="true" />
              {activeView === 'space'
                ? 'SPACE OPERATIONS · LIVE'
                : 'PERSONAL OPERATIONS · LIVE'}
            </span>
            <Typography.Title level={1} className={styles.commandTitle}>
              {activeView === 'space' ? '空间运营中心' : '我的工作台'}
            </Typography.Title>
            <Typography.Paragraph className={styles.commandDescription}>
              {activeView === 'space'
                ? '聚合房源发布与成交转签进度，快速识别影响空间经营的待处理事项。'
                : '聚合我的任务与公告，优先处理影响今日进度的事项。'}
            </Typography.Paragraph>
            <div className={styles.commandMeta}>
              <Typography.Text strong>{organizationName}</Typography.Text>
              <span className={styles.commandMetaDivider} aria-hidden="true" />
              <Typography.Text>
                {dayjs().format('YYYY年M月D日')}
              </Typography.Text>
              {activeDataStatus.isFetching || activeDataStatus.updatedAt ? (
                <>
                  <span
                    className={styles.commandMetaDivider}
                    aria-hidden="true"
                  />
                  <Typography.Text
                    className={styles.commandDataStatus}
                    aria-live="polite"
                  >
                    {activeDataStatus.isFetching ? (
                      <>
                        <Spin size="small" />
                        数据更新中
                      </>
                    ) : (
                      `数据更新于 ${activeDataStatus.updatedAt}`
                    )}
                  </Typography.Text>
                </>
              ) : null}
            </div>
          </div>
          <div className={styles.commandActions}>
            <Space wrap className={styles.commandActionsGroup}>
              {canViewSpaceWorkbench ? (
                <Segmented
                  aria-label="切换工作台视角"
                  className={styles.workbenchSwitcher}
                  disabled={layout.isEditing}
                  options={[
                    {
                      value: 'mine',
                      label: mobile ? '我的' : '我的工作台',
                      icon: <UserOutlined aria-hidden="true" />,
                    },
                    {
                      value: 'space',
                      label: mobile ? '空间' : '空间工作台',
                      icon: <ApartmentOutlined aria-hidden="true" />,
                    },
                  ]}
                  value={activeView}
                  onChange={changeView}
                />
              ) : (
                <div className={styles.singleWorkbenchIndicator}>
                  <span
                    className={styles.singleWorkbenchIndicatorIcon}
                    aria-hidden="true"
                  >
                    <UserOutlined />
                  </span>
                  <span>我的工作台</span>
                </div>
              )}
              <Tooltip title={customizationLabel}>
                <Button
                  aria-label={customizationLabel}
                  className={styles.customizeButton}
                  type="text"
                  icon={<EllipsisOutlined aria-hidden="true" />}
                  disabled={!layout.isReady || layout.loadError}
                  onClick={openCustomization}
                />
              </Tooltip>
            </Space>
          </div>
          {layout.isEditing ? (
            <WorkbenchEditToolbar
              viewLabel={viewLabel}
              isDirty={layout.isDirty}
              isSaving={layout.isSaving}
              canSave={layout.canSave}
              onRestore={layout.restoreDefaults}
              onCancel={cancelEditing}
              onSave={saveLayout}
            />
          ) : null}
        </header>

        {layout.loadError ? (
          <Alert
            showIcon
            type="error"
            title="工作台布局加载失败"
            description="当前暂时使用默认布局；重新加载成功前不能保存个性化设置。"
            action={
              <Button size="small" danger onClick={() => void layout.retry()}>
                重试
              </Button>
            }
          />
        ) : null}

        {activeView === 'mine' ? (
          <MineWorkbenchContent
            layout={layout.rendered}
            editing={layout.isEditing}
            mobile={mobile}
            onReorder={reorder}
            onWidthChange={changeWidth}
            onDataStatusChange={(isFetching, updatedAt) =>
              updateDataStatus('mine', isFetching, updatedAt)
            }
          />
        ) : (
          <SpaceWorkbenchContent
            layout={layout.rendered}
            editing={layout.isEditing}
            mobile={mobile}
            onReorder={reorder}
            onWidthChange={changeWidth}
            onDataStatusChange={(isFetching, updatedAt) =>
              updateDataStatus('space', isFetching, updatedAt)
            }
          />
        )}

        <WorkbenchCustomizeDrawer
          open={layout.isEditing && drawerOpen}
          mobile={mobile}
          definitions={definitions}
          layout={layout.draft}
          onClose={() => setDrawerOpen(false)}
          onVisibilityChange={changeVisibility}
          onWidthChange={changeWidth}
        />
      </div>
    </TenantSelectionGuard>
  );
};

export default TeamOperationsWorkbenchPage;
