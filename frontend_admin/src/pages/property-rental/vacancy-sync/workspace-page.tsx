import { WarningOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { history } from '@umijs/max';
import { Alert, Modal, message, Space, Typography } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  TenantSelectionGuard,
  useTenantWorkspace,
} from '@/pages/tenant/shared';
import {
  houseApi,
  type VacancySyncInput,
  type VacancySyncResult,
} from '@/services/manual/house';
import {
  SAMPLE_TEXT,
  useVacancySyncStyles,
  VacancySyncBuildingCard,
  VacancySyncEmptyState,
  VacancySyncSourcePanel,
  VacancySyncSummary,
} from './components';

const AUTO_PREVIEW_DELAY_MS = 600;

const VacancySyncWorkspacePage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const { styles } = useVacancySyncStyles();
  const [modal, modalContextHolder] = Modal.useModal();
  const [rawText, setRawText] = useState('');
  const [ignoredLines, setIgnoredLines] = useState<Set<number>>(new Set());
  const [buildingOverrides, setBuildingOverrides] = useState<
    Record<number, number>
  >({});
  const [preview, setPreview] = useState<VacancySyncResult | null>(null);
  const [previewInput, setPreviewInput] = useState<VacancySyncInput | null>(
    null,
  );
  const lastAutoPreviewTextRef = useRef<string | null>(null);
  const autoPreviewTimerRef = useRef<number | null>(null);

  const buildPayload = useCallback(
    (
      mode: 'preview' | 'apply',
      nextIgnoredLines = ignoredLines,
      nextBuildingOverrides = buildingOverrides,
      planHash?: string | null,
    ): VacancySyncInput => ({
      mode,
      raw_text: rawText,
      ignored_lines: [...nextIgnoredLines].sort((left, right) => left - right),
      building_overrides: Object.entries(nextBuildingOverrides)
        .map(([blockIndex, buildingId]) => ({
          block_index: Number(blockIndex),
          building_id: buildingId,
        }))
        .sort((left, right) => left.block_index - right.block_index),
      plan_hash: planHash ?? null,
    }),
    [buildingOverrides, ignoredLines, rawText],
  );

  const previewMutation = useMutation({
    mutationFn: (payload: VacancySyncInput) => houseApi.vacancySync(payload),
  });

  const applyMutation = useMutation({
    mutationFn: (payload: VacancySyncInput) => houseApi.vacancySync(payload),
    onSuccess: async (result) => {
      setPreview(result);
      message.success('房表同步完成');
      await workspace.queryClient.invalidateQueries({ queryKey: ['house'] });
    },
  });

  const runPreview = useCallback(
    async (
      nextIgnoredLines = ignoredLines,
      nextBuildingOverrides = buildingOverrides,
    ) => {
      if (autoPreviewTimerRef.current !== null) {
        window.clearTimeout(autoPreviewTimerRef.current);
        autoPreviewTimerRef.current = null;
      }
      if (!rawText.trim()) {
        message.warning('请先粘贴房表内容');
        return;
      }

      lastAutoPreviewTextRef.current = rawText;
      const payload = buildPayload(
        'preview',
        nextIgnoredLines,
        nextBuildingOverrides,
      );
      try {
        const result = await previewMutation.mutateAsync(payload);
        setPreview(result);
        setPreviewInput(payload);
      } catch {
        // 全局请求层已经展示错误，保留当前输入与最近一次预览。
      }
    },
    [
      buildPayload,
      buildingOverrides,
      ignoredLines,
      previewMutation.mutateAsync,
      rawText,
    ],
  );

  useEffect(() => {
    if (
      !rawText.trim() ||
      preview?.applied ||
      previewInput?.raw_text === rawText ||
      previewMutation.isPending ||
      lastAutoPreviewTextRef.current === rawText
    )
      return;

    autoPreviewTimerRef.current = window.setTimeout(() => {
      autoPreviewTimerRef.current = null;
      void runPreview();
    }, AUTO_PREVIEW_DELAY_MS);

    return () => {
      if (autoPreviewTimerRef.current !== null) {
        window.clearTimeout(autoPreviewTimerRef.current);
        autoPreviewTimerRef.current = null;
      }
    };
  }, [
    preview?.applied,
    previewInput?.raw_text,
    previewMutation.isPending,
    rawText,
    runPreview,
  ]);

  const updateIgnoredLine = async (lineNumber: number, ignored: boolean) => {
    const next = new Set(ignoredLines);
    if (ignored) next.add(lineNumber);
    else next.delete(lineNumber);
    setIgnoredLines(next);
    await runPreview(next, buildingOverrides);
  };

  const updateBuildingOverride = async (
    blockIndex: number,
    buildingId?: number,
  ) => {
    const next = { ...buildingOverrides };
    if (buildingId) next[blockIndex] = buildingId;
    else delete next[blockIndex];
    setBuildingOverrides(next);
    await runPreview(ignoredLines, next);
  };

  const resetPage = (nextText = '') => {
    setRawText(nextText);
    setIgnoredLines(new Set());
    setBuildingOverrides({});
    setPreview(null);
    setPreviewInput(null);
    lastAutoPreviewTextRef.current = null;
    if (autoPreviewTimerRef.current !== null) {
      window.clearTimeout(autoPreviewTimerRef.current);
      autoPreviewTimerRef.current = null;
    }
  };

  const previewStale = Boolean(
    preview &&
      !preview.applied &&
      previewInput &&
      previewInput.raw_text !== rawText,
  );
  const canConfirm = Boolean(
    preview?.can_apply &&
      preview.plan_hash &&
      !preview.applied &&
      !previewStale &&
      !previewMutation.isPending &&
      !applyMutation.isPending,
  );

  const confirmApply = () => {
    if (
      !preview?.can_apply ||
      !preview.plan_hash ||
      preview.applied ||
      previewStale
    )
      return;
    modal.confirm({
      title: '确认执行房表同步',
      icon: <WarningOutlined />,
      width: 580,
      content: (
        <Space orientation="vertical" size={10}>
          <Typography.Text>
            本次将处理 {preview.summary.buildings} 栋楼、
            {preview.summary.valid_lines} 条有效房源。
          </Typography.Text>
          <Space size={[4, 4]} wrap>
            <Typography.Text type="secondary">
              改为空置 {preview.summary.mark_vacant}
            </Typography.Text>
            <Typography.Text type="secondary">·</Typography.Text>
            <Typography.Text type="secondary">
              改为已租 {preview.summary.mark_rented}
            </Typography.Text>
            <Typography.Text type="secondary">·</Typography.Text>
            <Typography.Text type="secondary">
              新建房源 {preview.summary.create_houses}
            </Typography.Text>
          </Space>
          <Typography.Text type="secondary">
            清单内房源会改为空置，清单外房源会按空间配置改为已租。该操作会直接修改房态和房源资料。
          </Typography.Text>
        </Space>
      ),
      okText: '确认执行同步',
      cancelText: '返回检查',
      onOk: () =>
        applyMutation.mutateAsync(
          buildPayload(
            'apply',
            ignoredLines,
            buildingOverrides,
            preview.plan_hash,
          ),
        ),
    });
  };

  return (
    <TenantSelectionGuard title="房表同步">
      {modalContextHolder}
      <div className={styles.root}>
        <div className={styles.workspace}>
          <VacancySyncSourcePanel
            rawText={rawText}
            preview={preview}
            previewStale={previewStale}
            onChange={setRawText}
            onPreview={() => void runPreview()}
            onClear={() => resetPage()}
            canConfirm={canConfirm}
            previewing={previewMutation.isPending}
            applying={applyMutation.isPending}
            onConfirm={confirmApply}
            onReset={() => resetPage()}
            onViewHouses={() => history.push('/property-rental/houses')}
          />

          <div
            className={styles.resultColumn}
            data-testid="vacancy-sync-result-panel"
          >
            {preview ? <VacancySyncSummary preview={preview} /> : null}
            {!preview ? (
              <VacancySyncEmptyState
                onLoadSample={() => resetPage(SAMPLE_TEXT)}
                hasContent={Boolean(rawText.trim())}
              />
            ) : (
              <div className={previewStale ? styles.staleContent : undefined}>
                {!preview.applied &&
                !preview.can_apply &&
                preview.errors.length ? (
                  <Alert
                    type="error"
                    showIcon
                    title="请处理以下问题"
                    description={
                      <Space orientation="vertical" size={2}>
                        {preview.errors.map((error) => (
                          <Typography.Text
                            key={`${error.code}-${error.block_index ?? 'global'}-${error.line_number ?? 'none'}-${error.message}`}
                          >
                            {error.line_number
                              ? `第 ${error.line_number} 行：`
                              : ''}
                            {error.message}
                          </Typography.Text>
                        ))}
                      </Space>
                    }
                    style={{ marginBottom: 10 }}
                  />
                ) : null}

                {preview.blocks.map((block) => (
                  <VacancySyncBuildingCard
                    key={block.block_index}
                    block={block}
                    buildingOverride={buildingOverrides[block.block_index]}
                    disabled={previewStale || preview.applied}
                    pending={previewMutation.isPending}
                    onBuildingOverride={(blockIndex, buildingId) =>
                      void updateBuildingOverride(blockIndex, buildingId)
                    }
                    onIgnoredLineChange={(lineNumber, ignored) =>
                      void updateIgnoredLine(lineNumber, ignored)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </TenantSelectionGuard>
  );
};

export default VacancySyncWorkspacePage;
