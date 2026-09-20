import {
  ArrowRightOutlined,
  CheckOutlined,
  DownOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Skeleton, Tooltip } from 'antd';
import { createStyles } from 'antd-style';
import dayjs from 'dayjs';
import React, { useId, useMemo, useState } from 'react';
import AIButton from '@/components/AIButton';
import { AppIcon } from '@/components/AppIcon';
import { type HouseAIInsightResponse, houseApi } from '@/services/manual/house';

const useStyles = createStyles(({ css, token }) => ({
  card: css`
    container-type: inline-size;
    border-color: ${token.colorBorderSecondary};
    background: linear-gradient(
      115deg,
      color-mix(in srgb, ${token.colorPrimaryBg} 38%, ${token.colorBgContainer}) 0%,
      ${token.colorBgContainer} 50%
    );
  `,
  body: css`
    padding: 20px 24px 12px !important;

    @media (max-width: ${token.screenMD}px) {
      padding: 16px 16px 10px !important;
    }
  `,
  mark: css`
    width: 30px;
    height: 30px;
    flex: 0 0 30px;
    border: 1px solid ${token.colorPrimaryBorder};
    border-radius: ${token.borderRadiusLG}px;
    color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
  `,
  title: css`
    margin: 0;
    color: ${token.colorText};
    font-size: ${token.fontSizeLG}px;
    font-weight: ${token.fontWeightStrong};
    line-height: 1.5;
  `,
  subtle: css`
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
  `,
  action: css`
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
    transition: color ${token.motionDurationFast}, background-color ${token.motionDurationFast}, transform ${token.motionDurationFast};

    &:active {
      transform: scale(0.97);
    }

    &:focus-visible {
      outline: 2px solid ${token.colorPrimary};
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
      &:active { transform: none; }
    }
  `,
  layout: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(260px, 0.68fr);
    align-items: start;
    gap: 28px;

    @container (max-width: 720px) {
      grid-template-columns: minmax(0, 1fr);
      gap: 16px;
    }
  `,
  conclusion: css`
    margin: 0;
    max-width: 44em;
    color: ${token.colorText};
    font-size: ${token.fontSizeLG}px;
    font-weight: 500;
    line-height: 1.75;
    overflow-wrap: anywhere;
    text-wrap: pretty;
  `,
  signals: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 12px 20px;
    padding: 0;
    margin: 18px 0 0;
    list-style: none;
  `,
  signal: css`
    min-width: 0;
    color: ${token.colorText};
    font-size: ${token.fontSize}px;
    line-height: 1.6;
    overflow-wrap: anywhere;

    [data-tone='positive'] { color: ${token.colorSuccessText}; }
    [data-tone='caution'] { color: ${token.colorWarningText}; }
    [data-tone='neutral'] { color: ${token.colorTextTertiary}; }
  `,
  legacySignals: css`
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    margin-top: 14px;
  `,
  appeal: css`
    padding-top: 14px;
    margin-top: 16px;
    border-top: 1px solid ${token.colorBorderSecondary};
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSize}px;
    line-height: 1.6;
    overflow-wrap: anywhere;
  `,
  questions: css`
    padding: 16px 18px;
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};
    color: ${token.colorText};
    font-size: ${token.fontSize}px;
    line-height: 1.6;
    overflow-wrap: anywhere;
  `,
  sectionTitle: css`
    margin: 0;
    font-size: ${token.fontSizeSM}px;
    font-weight: ${token.fontWeightStrong};
    color: ${token.colorTextSecondary};
  `,
  question: css`
    & + & {
      padding-top: 10px;
      border-top: 1px solid ${token.colorBorderSecondary};
    }
  `,
  index: css`
    padding-top: 2px;
    font-size: ${token.fontSizeSM}px;
    font-variant-numeric: tabular-nums;
    color: ${token.colorTextTertiary};
  `,
  footer: css`
    margin-top: 18px;
    padding-top: 8px;
    border-top: 1px solid ${token.colorBorderSecondary};
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
  `,
  evidence: css`
    padding-top: 14px;
    margin-top: 8px;
    border-top: 1px dashed ${token.colorBorderSecondary};
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
    line-height: 1.65;
    overflow-wrap: anywhere;
  `,
  notice: css`
    color: ${token.colorWarningText};
    font-size: ${token.fontSizeSM}px;
  `,
}));

type Props = {
  enabled: boolean;
  houseId: number;
  organizationSlug?: string;
};

function requestErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as {
    info?: { code?: number };
    response?: { status?: number; data?: { code?: number } };
  };
  return (
    candidate.info?.code ||
    candidate.response?.data?.code ||
    candidate.response?.status
  );
}

function requestErrorMessage(error: unknown) {
  if (!error || typeof error !== 'object')
    return '租房速览暂时不可用，请稍后重试。';
  const candidate = error as {
    info?: { error?: string; message?: string };
    message?: string;
    response?: { data?: { error?: string; message?: string } };
  };
  return (
    candidate.info?.message ||
    candidate.info?.error ||
    candidate.response?.data?.message ||
    candidate.response?.data?.error ||
    candidate.message ||
    '租房速览暂时不可用，请稍后重试。'
  );
}

function InsightResult({ data }: { data: HouseAIInsightResponse }) {
  const { cx, styles } = useStyles();
  const evidenceId = useId();
  const [showEvidence, setShowEvidence] = useState(false);
  const insight = data.insight;
  const evidence = useMemo(() => {
    if (!insight) return { facts: [], missingFields: [] };
    const usedFactIds = new Set([
      ...insight.conclusion.fact_ids,
      ...insight.signals.flatMap((item) => item.fact_ids),
      ...insight.appeal_points.flatMap((item) => item.fact_ids),
      ...insight.viewing_questions.flatMap((item) => item.fact_ids),
    ]);
    const usedMissingFieldKeys = new Set(
      insight.viewing_questions.flatMap((item) => item.missing_field_keys),
    );
    return {
      facts: insight.facts.filter((fact) => usedFactIds.has(fact.id)),
      missingFields: insight.missing_fields.filter((field) =>
        usedMissingFieldKeys.has(field.key),
      ),
    };
  }, [insight]);

  if (!insight) return null;
  const isLegacy = insight.schema_version < 3;
  const evidenceCount = evidence.facts.length + evidence.missingFields.length;
  const generatedAt = data.generated_at
    ? dayjs(data.generated_at).format('YYYY-MM-DD HH:mm')
    : '';
  const expiresAt = data.expires_at
    ? dayjs(data.expires_at).format('YYYY-MM-DD HH:mm')
    : '';
  const statusText = data.source_changed
    ? '房源资料有更新'
    : isLegacy
      ? '旧版速览 · 可更新'
      : data.state === 'expired'
        ? '内容已过期'
        : '';
  const timeDescription = [
    generatedAt && `生成于 ${generatedAt}`,
    isLegacy
      ? '内容版本已更新，建议重新生成'
      : expiresAt && `有效至 ${expiresAt}`,
    data.source_changed && '当前速览基于更新前的公开资料',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <div
        className={insight.viewing_questions.length ? styles.layout : undefined}
      >
        <div className="min-w-0">
          <p className={styles.conclusion}>{insight.conclusion.text}</p>
          {insight.signals.length ? (
            <ul
              className={cx(styles.signals, isLegacy && styles.legacySignals)}
              aria-label="租房关键信号"
            >
              {insight.signals.map((signal) => {
                const icon =
                  signal.tone === 'positive' ? (
                    <CheckOutlined />
                  ) : signal.tone === 'caution' ? (
                    <ExclamationCircleOutlined />
                  ) : (
                    <InfoCircleOutlined />
                  );
                return (
                  <li
                    className={styles.signal}
                    key={`${signal.label}-${signal.value}`}
                  >
                    {isLegacy ? (
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-0.5 shrink-0"
                          data-tone={signal.tone}
                          aria-hidden="true"
                        >
                          {icon}
                        </span>
                        <span>{signal.value}</span>
                      </div>
                    ) : (
                      <>
                        <div
                          className={cx(
                            'mb-1 flex items-center gap-1.5',
                            styles.subtle,
                          )}
                        >
                          <span data-tone={signal.tone} aria-hidden="true">
                            {icon}
                          </span>
                          <span>{signal.label}</span>
                        </div>
                        <span>{signal.value}</span>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {insight.appeal_points.length ? (
            <section className={styles.appeal} aria-label="值得关注的特点">
              <h3 className={styles.sectionTitle}>值得关注的特点</h3>
              <ul className="m-0 mt-2 grid list-none gap-1.5 p-0">
                {insight.appeal_points.map((item) => (
                  <li className="flex items-start gap-2" key={item.text}>
                    <CheckOutlined
                      className="mt-1 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
        {insight.viewing_questions.length ? (
          <section className={styles.questions} aria-label="看房前先确认">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className={styles.sectionTitle}>看房前先确认</h3>
              <ArrowRightOutlined
                className={styles.subtle}
                aria-hidden="true"
              />
            </div>
            <ol className="m-0 grid list-none gap-2.5 p-0">
              {insight.viewing_questions.map((item, index) => (
                <li
                  className={cx(
                    'grid grid-cols-[20px_minmax(0,1fr)] gap-2',
                    styles.question,
                  )}
                  key={item.text}
                >
                  <span className={styles.index} aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>
      <div
        className={cx(
          'flex flex-wrap items-center justify-between gap-x-4 gap-y-1',
          styles.footer,
        )}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>AI 生成 · 仅供参考</span>
          {generatedAt ? (
            <Tooltip title={timeDescription}>
              <time dateTime={data.generated_at || undefined}>
                {dayjs(data.generated_at).format('MM-DD HH:mm')}
              </time>
            </Tooltip>
          ) : null}
          {statusText ? (
            <Tooltip title={timeDescription}>
              <span className={styles.notice}>{statusText}</span>
            </Tooltip>
          ) : null}
        </div>
        {evidenceCount ? (
          <Button
            className={styles.action}
            type="text"
            size="small"
            aria-expanded={showEvidence}
            aria-controls={evidenceId}
            icon={
              showEvidence ? (
                <UpOutlined aria-hidden="true" />
              ) : (
                <DownOutlined aria-hidden="true" />
              )
            }
            iconPlacement="end"
            onClick={() => setShowEvidence((value) => !value)}
          >
            {showEvidence ? '收起内容依据' : `查看内容依据（${evidenceCount}）`}
          </Button>
        ) : null}
      </div>
      <div id={evidenceId} hidden={!showEvidence} className={styles.evidence}>
        {showEvidence ? (
          <>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className={styles.sectionTitle}>内容依据</h3>
              <span>基于生成时的公开房源资料</span>
            </div>
            <ul className="m-0 grid list-none gap-x-6 gap-y-1.5 p-0 sm:grid-cols-2">
              {evidence.facts.map((fact) => (
                <li key={fact.id}>
                  {fact.label} · {fact.value}
                </li>
              ))}
              {evidence.missingFields.map((field) => (
                <li className={styles.notice} key={field.key}>
                  未说明 · {field.label}
                </li>
              ))}
            </ul>
            <p className="mb-0 mt-3">{timeDescription}</p>
            <p className="mb-0 mt-1">
              AI 生成内容仅供租房参考，实际情况以看房和合同约定为准。
            </p>
          </>
        ) : null}
      </div>
    </>
  );
}

const HouseAIInsightCard: React.FC<Props> = ({
  enabled,
  houseId,
  organizationSlug,
}) => {
  const { cx, styles } = useStyles();
  const queryClient = useQueryClient();
  const queryKey = ['house', 'ai-insight', organizationSlug, houseId];
  const insight = useQuery({
    queryKey,
    queryFn: () => houseApi.getHouseAIInsight(houseId),
    enabled,
    retry: (failureCount, error) => {
      const code = requestErrorCode(error);
      if (code === 401 || code === 403 || code === 404 || code === 503)
        return false;
      return failureCount < 2;
    },
  });
  const generate = useMutation({
    mutationFn: () => houseApi.generateHouseAIInsight(houseId),
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
    onError: (error) => {
      if (requestErrorCode(error) === 409) void insight.refetch();
    },
  });

  if (!enabled) return null;
  if (
    insight.isError &&
    [401, 403, 404, 503].includes(requestErrorCode(insight.error) || 0)
  )
    return null;

  const data = insight.data;
  const canGenerate =
    data?.insight &&
    (data.state === 'expired' || data.insight.schema_version < 3);

  return (
    <Card className={styles.card} classNames={{ body: styles.body }}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cx('grid place-items-center', styles.mark)}
            aria-hidden="true"
          >
            <AppIcon name="ai" width={20} height={20} aria-hidden="true" />
          </span>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h2 className={styles.title}>AI 租房速览</h2>
            <span className={styles.subtle}>帮你读懂这套房</span>
          </div>
        </div>
        {canGenerate ? (
          <AIButton
            loading={generate.isPending}
            onClick={() => generate.mutate()}
          >
            重新生成
          </AIButton>
        ) : null}
      </div>
      {insight.isLoading ? (
        <Skeleton active title={false} paragraph={{ rows: 3 }} />
      ) : insight.isError && !data?.insight ? (
        <Alert
          showIcon
          type="error"
          title="租房速览加载失败"
          description={requestErrorMessage(insight.error)}
          action={<Button onClick={() => insight.refetch()}>重新加载</Button>}
        />
      ) : data?.insight ? (
        <InsightResult key={`${organizationSlug}-${houseId}`} data={data} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
          <div className="min-w-0">
            <p className="m-0 mb-1">这套房值得关注什么？看房前要问清什么？</p>
            <p className={cx('m-0', styles.subtle)}>
              基于公开房源资料，为你整理一份租房参考。
            </p>
          </div>
          <AIButton
            loading={generate.isPending}
            onClick={() => generate.mutate()}
          >
            生成租房速览
          </AIButton>
        </div>
      )}
      {generate.isError ? (
        <Alert
          className="mt-3"
          showIcon
          type="error"
          title={
            data?.insight
              ? '新内容生成失败，已保留上次结果'
              : '租房速览生成失败'
          }
          description={requestErrorMessage(generate.error)}
        />
      ) : null}
    </Card>
  );
};

export default HouseAIInsightCard;
