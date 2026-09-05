import { FilterOutlined } from '@ant-design/icons';
import {
  Badge,
  Button,
  Divider,
  Drawer,
  Flex,
  Form,
  Space,
  Tooltip,
  theme,
} from 'antd';
import { createStyles } from 'antd-style';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { AdminToolbar, drawerWidthSm } from '@/pages/_shared/adminLayout';
import { resolveResponsiveFilterOverflow } from './overflow';

const useStyles = createStyles(({ css, token }) => ({
  toolbarRow: css`
    display: flex;
    width: 100%;
    min-width: 0;
    align-items: center;
    justify-content: flex-end;
    gap: ${token.marginXS}px;
    overflow: hidden;
  `,
  toolbarGroup: css`
    display: flex;
    min-width: 0;
    flex: 0 0 auto;
    align-items: center;
    gap: ${token.marginXS}px;
  `,
  responsiveFilter: css`
    min-width: 0;
    flex: 0 0 auto;
  `,
  drawerOverflowFilters: css`
    .ant-select,
    .ant-input-affix-wrapper,
    .ant-input-search,
    .ant-input-number,
    .ant-picker {
      width: 100% !important;
    }
  `,
  visuallyHidden: css`
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  `,
}));

export type AdvancedFilterToolbarResponsiveItem = {
  active?: boolean;
  content: React.ReactNode;
  drawerContent?: React.ReactNode;
  key: string;
  priority?: number;
};

const EMPTY_RESPONSIVE_FILTERS: AdvancedFilterToolbarResponsiveItem[] = [];

export type AdvancedFilterToolbarProps = {
  actions?: React.ReactNode;
  advancedActive?: boolean;
  advancedContent: React.ReactNode;
  children?: React.ReactNode;
  confirmLoading?: boolean;
  confirmText?: React.ReactNode;
  defaultOpen?: boolean;
  disabled?: boolean;
  onConfirm: () => Promise<void> | void;
  onOpenChange?: (open: boolean) => void;
  onResponsiveOverflowChange?: (keys: string[]) => void;
  onReset?: () => void;
  open?: boolean;
  resetText?: React.ReactNode;
  responsiveFilters?: AdvancedFilterToolbarResponsiveItem[];
  title?: React.ReactNode;
  triggerAriaLabel?: string;
  triggerText?: React.ReactNode;
  triggerTooltip?: React.ReactNode;
  width?: number | string;
};

export const AdvancedFilterToolbar: React.FC<AdvancedFilterToolbarProps> = ({
  actions,
  advancedActive = false,
  advancedContent,
  children,
  confirmLoading = false,
  confirmText = '确定筛选',
  defaultOpen = false,
  disabled = false,
  onConfirm,
  onOpenChange,
  onResponsiveOverflowChange,
  onReset,
  open,
  resetText = '重置',
  responsiveFilters = EMPTY_RESPONSIVE_FILTERS,
  title = '高级筛选',
  triggerAriaLabel,
  triggerText = '高级筛选',
  triggerTooltip,
  width = drawerWidthSm,
}) => {
  const { styles } = useStyles();
  const { token } = theme.useToken();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [internalConfirmLoading, setInternalConfirmLoading] = useState(false);
  const [overflowFilterKeys, setOverflowFilterKeys] = useState<string[]>([]);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const childrenRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const filterRefs = useRef(new Map<string, HTMLDivElement>());
  const filterWidthCache = useRef(new Map<string, number>());
  const onResponsiveOverflowChangeRef = useRef(onResponsiveOverflowChange);
  onResponsiveOverflowChangeRef.current = onResponsiveOverflowChange;
  const controlled = open !== undefined;
  const mergedOpen = controlled ? open : internalOpen;
  const submitting = confirmLoading || internalConfirmLoading;
  const iconOnly = triggerText === null || triggerText === false;
  const mergedTriggerAriaLabel =
    triggerAriaLabel ||
    (typeof triggerText === 'string' ? triggerText : '高级筛选');
  const overflowFilterKeySet = new Set(overflowFilterKeys);
  const overflowFilters = responsiveFilters.filter((item) =>
    overflowFilterKeySet.has(item.key),
  );
  const mergedAdvancedActive =
    advancedActive || overflowFilters.some((item) => item.active);
  const triggerAccessibleName =
    mergedAdvancedActive && !mergedOpen
      ? `${mergedTriggerAriaLabel}，已生效`
      : mergedTriggerAriaLabel;
  const mergedTriggerTooltip =
    triggerTooltip ?? (iconOnly ? triggerAccessibleName : undefined);

  const calculateResponsiveOverflow = useCallback(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;

    const toolbarItemWrapper = toolbar.parentElement?.parentElement;
    const toolbarHostCandidate = toolbarItemWrapper?.parentElement;
    const toolbarHost = toolbarHostCandidate?.classList.contains(
      'ant-pro-table-list-toolbar-right',
    )
      ? toolbarHostCandidate
      : null;
    const hostStyle = toolbarHost ? window.getComputedStyle(toolbarHost) : null;
    const hostGap = hostStyle
      ? Number.parseFloat(hostStyle.columnGap || hostStyle.gap) || 0
      : 0;
    const siblingWidths = toolbarHost
      ? Array.from(toolbarHost.children).reduce(
          (total, element) =>
            element === toolbarItemWrapper
              ? total
              : total + element.getBoundingClientRect().width,
          0,
        )
      : 0;
    const availableWidth = toolbarHost
      ? toolbarHost.clientWidth -
        siblingWidths -
        Math.max(0, toolbarHost.children.length - 1) * hostGap
      : toolbar.clientWidth;
    if (availableWidth <= 0) return;

    for (const item of responsiveFilters) {
      const width = filterRefs.current
        .get(item.key)
        ?.getBoundingClientRect().width;
      if (width && width > 0) filterWidthCache.current.set(item.key, width);
    }

    const computedStyle = window.getComputedStyle(toolbar);
    const gap =
      Number.parseFloat(computedStyle.columnGap || computedStyle.gap) || 0;
    const nextOverflowKeys = resolveResponsiveFilterOverflow({
      availableWidth,
      fixedWidths: [
        children ? childrenRef.current?.getBoundingClientRect().width || 0 : 0,
        triggerRef.current?.getBoundingClientRect().width || 0,
        actions ? actionsRef.current?.getBoundingClientRect().width || 0 : 0,
      ],
      gap,
      items: responsiveFilters.map((item) => ({
        key: item.key,
        priority: item.priority,
        width:
          filterRefs.current.get(item.key)?.getBoundingClientRect().width ||
          filterWidthCache.current.get(item.key) ||
          0,
      })),
    });

    setOverflowFilterKeys((current) =>
      current.length === nextOverflowKeys.length &&
      current.every((key, index) => key === nextOverflowKeys[index])
        ? current
        : nextOverflowKeys,
    );
  }, [actions, children, responsiveFilters]);

  useLayoutEffect(() => {
    calculateResponsiveOverflow();
  }, [calculateResponsiveOverflow]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !toolbarRef.current) return;
    const observer = new ResizeObserver(calculateResponsiveOverflow);
    observer.observe(toolbarRef.current);
    const toolbarHost =
      toolbarRef.current.parentElement?.parentElement?.parentElement;
    if (toolbarHost) observer.observe(toolbarHost);
    if (childrenRef.current) observer.observe(childrenRef.current);
    if (triggerRef.current) observer.observe(triggerRef.current);
    if (actionsRef.current) observer.observe(actionsRef.current);
    return () => observer.disconnect();
  }, [calculateResponsiveOverflow]);

  useEffect(() => {
    onResponsiveOverflowChangeRef.current?.(overflowFilterKeys);
  }, [overflowFilterKeys]);

  const requestOpenChange = (nextOpen: boolean) => {
    if (submitting && !nextOpen) return;
    if (!controlled) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const handleConfirm = async () => {
    if (disabled || submitting) return;
    try {
      const result = onConfirm();
      if (result) {
        setInternalConfirmLoading(true);
        await result;
      }
      requestOpenChange(false);
    } catch {
      // 具体错误由调用页面展示；保留抽屉和草稿供用户修正。
    } finally {
      setInternalConfirmLoading(false);
    }
  };

  return (
    <>
      <AdminToolbar>
        <div
          className={styles.toolbarRow}
          data-advanced-filter-toolbar="row"
          ref={toolbarRef}
        >
          {children ? (
            <div
              className={styles.toolbarGroup}
              data-toolbar-fixed="children"
              ref={childrenRef}
            >
              {children}
            </div>
          ) : null}
          {responsiveFilters.map((item) =>
            overflowFilterKeySet.has(item.key) ? null : (
              <div
                className={styles.responsiveFilter}
                data-responsive-filter-key={item.key}
                key={item.key}
                ref={(node) => {
                  if (node) filterRefs.current.set(item.key, node);
                  else filterRefs.current.delete(item.key);
                }}
              >
                {item.content}
              </div>
            ),
          )}
          <div
            className={styles.toolbarGroup}
            data-toolbar-fixed="trigger"
            ref={triggerRef}
          >
            <Tooltip title={mergedTriggerTooltip}>
              <Badge
                color={token.colorPrimary}
                dot={mergedAdvancedActive && !mergedOpen}
                offset={[-2, 2]}
              >
                <Button
                  aria-label={iconOnly ? triggerAccessibleName : undefined}
                  disabled={disabled}
                  icon={<FilterOutlined aria-hidden />}
                  onClick={() => requestOpenChange(true)}
                >
                  {triggerText}
                  {mergedAdvancedActive && !mergedOpen && !iconOnly ? (
                    <span className={styles.visuallyHidden}>
                      高级筛选已生效
                    </span>
                  ) : null}
                </Button>
              </Badge>
            </Tooltip>
          </div>
          {actions ? (
            <div
              className={styles.toolbarGroup}
              data-toolbar-fixed="actions"
              ref={actionsRef}
            >
              {actions}
            </div>
          ) : null}
        </div>
      </AdminToolbar>
      <Drawer
        closable={{ disabled: submitting }}
        destroyOnHidden
        footer={
          <Flex
            align="center"
            gap="small"
            justify={onReset ? 'space-between' : 'flex-end'}
          >
            {onReset ? (
              <Button disabled={submitting} onClick={onReset}>
                {resetText}
              </Button>
            ) : null}
            <Space size="small">
              <Button
                disabled={submitting}
                onClick={() => requestOpenChange(false)}
              >
                取消
              </Button>
              <Button
                type="primary"
                disabled={disabled}
                loading={submitting}
                onClick={handleConfirm}
              >
                {confirmText}
              </Button>
            </Space>
          </Flex>
        }
        keyboard={!submitting}
        maskClosable={!submitting}
        open={mergedOpen}
        size={width}
        title={title}
        onClose={() => requestOpenChange(false)}
      >
        {overflowFilters.length ? (
          <>
            <Form
              className={styles.drawerOverflowFilters}
              disabled={disabled}
              layout="vertical"
              requiredMark={false}
            >
              {overflowFilters.map((item) => (
                <React.Fragment key={item.key}>
                  {item.drawerContent ?? item.content}
                </React.Fragment>
              ))}
            </Form>
            <Divider />
          </>
        ) : null}
        {advancedContent}
      </Drawer>
    </>
  );
};

export default AdvancedFilterToolbar;
