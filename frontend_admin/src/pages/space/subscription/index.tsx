import {
  ApartmentOutlined,
  ApiOutlined,
  ArrowRightOutlined,
  BarChartOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  CheckOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  WalletOutlined,
  WechatOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { history } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Modal,
  message,
  Progress,
  Segmented,
  Tag,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import {
  appsSubscriptionsApiCreateOrder,
  appsSubscriptionsApiCurrentSubscription,
  appsSubscriptionsApiGetOrder,
  appsSubscriptionsApiListPlans,
} from '@/services/openapi/subscriptions';
import { SPACE_PATHS } from '@/utils/adminRouting';
import { TenantSelectionGuard, useTenantWorkspace } from '../shared';

type Entitlement = {
  member_limit?: number | null;
  team_limit?: number | null;
  house_limit?: number | null;
  ends_at?: string | null;
  feature_flags?: Record<string, boolean>;
};

type Usage = { member?: number; team?: number; house?: number };

type PlanPrice = {
  billing_cycle?: string;
  amount?: number;
  display_note?: string;
};

type CurrentSubscription = {
  kind?: string;
  status?: string;
  billing_cycle?: string;
  starts_at?: string;
  ends_at?: string;
};

type UpgradeRecommendation = {
  reason: string;
  threshold_percent: number;
  target_plan_code: string;
  target_plan_name: string;
  triggered_resources: Array<{
    resource: string;
    current: number;
    limit: number;
    usage_percent: number;
  }>;
};

const PLAN_FALLBACK_DESCRIPTIONS: Record<string, string> = {
  free: '适合个人体验与轻量房源管理。',
  standard: '适合稳定运营中的小型团队，覆盖日常协作与基础经营分析。',
  professional: '为成长型团队提供更高额度、批量处理与经营分析能力。',
  enterprise: '面向规模化组织，提供开放接口、高级权限与更大业务容量。',
};

const PLAN_PRESENTATIONS: Record<
  string,
  { icon: React.ReactNode; tone: 'neutral' | 'blue' | 'orange' | 'purple' }
> = {
  free: { icon: <TeamOutlined />, tone: 'neutral' },
  standard: { icon: <ApartmentOutlined />, tone: 'blue' },
  professional: { icon: <ThunderboltOutlined />, tone: 'orange' },
  enterprise: { icon: <SafetyCertificateOutlined />, tone: 'purple' },
};

const FEATURE_LABELS: Record<string, string> = {
  data_export: '业务数据导出',
  business_analytics: '经营数据分析',
  batch_operations: '批量业务处理',
  advanced_access_control: '高级权限控制',
  api_integration: '开放 API 集成',
};

const PRODUCT_CAPABILITIES = [
  {
    key: 'scale',
    title: '规模扩容',
    tone: 'green',
    icon: <ApartmentOutlined />,
    description: '席位、团队与房源容量按阶段增长，避免资源不足影响业务推进。',
    points: ['按需升级', '平滑扩容'],
  },
  {
    key: 'data',
    title: '经营沉淀',
    tone: 'blue',
    icon: <BarChartOutlined />,
    description: '核心业务数据支持导出与分析，帮助团队持续积累经营资料。',
    points: ['数据导出', '经营分析'],
  },
  {
    key: 'efficiency',
    title: '批量提效',
    tone: 'purple',
    icon: <ThunderboltOutlined />,
    description: '通过批量操作降低重复性工作，让团队把时间投入到更重要的业务。',
    points: ['批量处理', '自动化'],
  },
  {
    key: 'governance',
    title: '组织治理',
    tone: 'orange',
    icon: <ApiOutlined />,
    description:
      '支持 API 与高级权限能力，满足更复杂的协作场景和系统连接需求。',
    points: ['开放接口', '权限管控'],
  },
];

const COMPARISON_ROWS = [
  {
    key: 'member_limit',
    label: '成员席位',
    icon: <TeamOutlined />,
    type: 'limit',
    unit: '人',
  },
  {
    key: 'team_limit',
    label: '团队数量',
    icon: <ApartmentOutlined />,
    type: 'limit',
    unit: '个',
  },
  {
    key: 'house_limit',
    label: '房源容量',
    icon: <AppIcon name="house" />,
    type: 'limit',
    unit: '套',
  },
  {
    key: 'data_export',
    label: '数据导出',
    icon: <DownloadOutlined />,
    type: 'feature',
  },
  {
    key: 'batch_operations',
    label: '批量处理',
    icon: <DatabaseOutlined />,
    type: 'feature',
  },
  {
    key: 'business_analytics',
    label: '经营分析',
    icon: <BarChartOutlined />,
    type: 'feature',
  },
  {
    key: 'api_integration',
    label: '开放 API',
    icon: <ApiOutlined />,
    type: 'feature',
  },
  {
    key: 'advanced_access_control',
    label: '高级权限',
    icon: <SafetyCertificateOutlined />,
    type: 'feature',
  },
] as const;

const SUBSCRIPTION_NOTES = [
  {
    key: 'activation',
    title: '权益自动生效',
    description: '支付成功后自动更新当前空间的套餐权益与使用额度。',
    icon: <CheckCircleFilled />,
  },
  {
    key: 'billing',
    title: '月付年付可选',
    description: '按团队预算灵活选择付费周期，年付方案可享对应优惠。',
    icon: <WalletOutlined />,
  },
  {
    key: 'workspace',
    title: '空间独立使用',
    description: '套餐权益归属于当前空间，成员与房源额度统一在空间内使用。',
    icon: <SafetyCertificateOutlined />,
  },
  {
    key: 'records',
    title: '购买记录可追溯',
    description: '订单、支付状态和套餐周期集中记录，方便后续查询核对。',
    icon: <FileTextOutlined />,
  },
];

const useStyles = createStyles(({ css, token }) => ({
  page: css`
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding-bottom: 24px;

    @media (min-width: 1200px) {
      margin-inline: -20px;
    }
  `,
  pageHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;

    @media (max-width: 767px) {
      align-items: stretch;
      flex-direction: column;
      gap: 16px;
    }
  `,
  pageTitle: css`
    margin: 0 0 6px !important;
    font-size: 26px !important;
    line-height: 1.25 !important;

    @media (max-width: 575px) {
      font-size: 22px !important;
    }
  `,
  pageDescription: css`
    margin: 0 !important;
    color: ${token.colorTextSecondary};
  `,
  pageActions: css`
    display: flex;
    flex: 0 0 auto;
    gap: 12px;

    .ant-btn {
      min-width: 112px;
      font-size: ${token.fontSize}px;
    }

    @media (max-width: 575px) {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  `,
  summaryCard: css`
    overflow: hidden;
    border-color: ${token.colorBorderSecondary};
    box-shadow: ${token.boxShadowTertiary};

    .ant-card-body {
      padding: 0;
    }
  `,
  summaryGrid: css`
    display: grid;
    grid-template-columns: minmax(320px, 36%) minmax(0, 64%);

    @media (max-width: 1199px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  summaryOverview: css`
    position: relative;
    display: flex;
    overflow: hidden;
    min-height: 256px;
    flex-direction: column;
    justify-content: center;
    padding: 24px 28px;
    border-right: 1px solid ${token.colorBorderSecondary};
    background: linear-gradient(135deg, ${token.colorPrimaryBg} 0%, ${token.colorBgContainer} 68%);

    @media (max-width: 1199px) {
      min-height: auto;
      border-right: 0;
      border-bottom: 1px solid ${token.colorBorderSecondary};
    }

    @media (max-width: 575px) {
      padding: 22px;
    }
  `,
  summaryDecoration: css`
    position: absolute;
    top: 50%;
    right: -4px;
    transform: translateY(-50%);
    color: ${token.colorPrimary};
    font-size: 126px;
    opacity: 0.075;
    pointer-events: none;

    @media (max-width: 575px) {
      font-size: 88px;
    }
  `,
  currentBadge: css`
    display: inline-flex;
    align-self: flex-start;
    margin-bottom: 12px;
    padding: 3px 9px;
    border-radius: ${token.borderRadiusSM}px;
    color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
    font-size: ${token.fontSizeSM}px;
    font-weight: ${token.fontWeightStrong};
  `,
  planTitleRow: css`
    position: relative;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  `,
  currentPlanTitle: css`
    margin: 0 !important;
    color: ${token.colorTextHeading} !important;
    font-size: 28px !important;
    line-height: 1.2 !important;

    @media (max-width: 575px) {
      font-size: 24px !important;
    }
  `,
  summaryDescription: css`
    position: relative;
    z-index: 1;
    max-width: 320px;
    margin-bottom: 14px !important;
    color: ${token.colorTextSecondary};
    line-height: 1.7;
  `,
  summaryMeta: css`
    position: relative;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  `,
  summaryMetaItem: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 9px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusSM}px;
    color: ${token.colorTextSecondary};
    background: ${token.colorFillQuaternary};
    font-size: ${token.fontSizeSM}px;
  `,
  usageSide: css`
    display: flex;
    min-width: 0;
    align-items: stretch;
    padding: 12px;

    @media (max-width: 575px) {
      padding: 16px;
    }
  `,
  usagePanel: css`
    display: grid;
    width: 100%;
    margin: 0;
    padding: 0;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    list-style: none;

    @media (min-width: 992px) and (max-width: 1199px) {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    @media (min-width: 768px) and (max-width: 991px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 767px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 480px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  usageCard: css`
    display: flex;
    min-width: 0;
    min-height: 104px;
    flex-direction: column;
    padding: 12px 14px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
  `,
  usageTopRow: css`
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    @media (min-width: 992px) and (max-width: 1199px) {
      align-items: flex-start;
      flex-direction: column;
      gap: 8px;
    }
  `,
  usageHeader: css`
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 9px;
  `,
  usageIcon: css`
    display: inline-flex;
    width: 28px;
    height: 28px;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    border: 1px solid ${token.colorPrimaryBorder};
    border-radius: 8px;
    color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
    font-size: 16px;
  `,
  usageLabel: css`
    min-width: 0;
    overflow: hidden;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
    font-weight: ${token.fontWeightStrong};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  usageValue: css`
    flex: 0 0 auto;
    margin: 0;
    color: ${token.colorTextHeading};
    font-size: 24px;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  `,
  usageLimit: css`
    margin-left: 4px;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
    font-weight: normal;
  `,
  usageProgressRow: css`
    margin-top: 8px;

    .ant-progress {
      margin: 0;
    }
  `,
  usageFooter: css`
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 4px;
  `,
  usagePercent: css`
    flex: 0 0 auto;
    color: ${token.colorTextSecondary};
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  `,
  usageNote: css`
    min-width: 0;
    overflow: hidden;
    color: ${token.colorTextTertiary};
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  summaryRecommendation: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 16px 24px;
    border-top: 1px solid ${token.colorBorderSecondary};
    background: color-mix(in srgb, ${token.colorPrimaryBg} 42%, ${token.colorBgContainer});

    @media (max-width: 767px) {
      align-items: stretch;
      flex-direction: column;
      gap: 14px;
      padding: 16px 20px;
    }
  `,
  summaryRecommendationMain: css`
    display: flex;
    min-width: 0;
    flex: 1;
    align-items: flex-start;
    gap: 12px;
  `,
  summaryRecommendationIcon: css`
    display: inline-flex;
    width: 36px;
    height: 36px;
    flex: 0 0 36px;
    align-items: center;
    justify-content: center;
    border: 1px solid ${token.colorPrimaryBorder};
    border-radius: 9px;
    color: ${token.colorPrimary};
    background: ${token.colorBgContainer};
    font-size: 17px;
  `,
  summaryRecommendationContent: css`
    min-width: 0;
  `,
  summaryRecommendationEyebrow: css`
    display: block;
    margin-bottom: 2px;
    color: ${token.colorPrimary};
    font-size: 12px;
    font-weight: ${token.fontWeightStrong};
  `,
  summaryRecommendationTitle: css`
    margin: 0 !important;
    font-size: 16px !important;
    line-height: 1.4 !important;
  `,
  summaryRecommendationPoints: css`
    display: flex;
    flex-wrap: wrap;
    gap: 5px 14px;
    margin-top: 6px;
  `,
  summaryRecommendationPoint: css`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: ${token.colorTextSecondary};
    font-size: 12px;
    white-space: nowrap;

    .anticon {
      color: ${token.colorPrimary};
      font-size: 11px;
    }
  `,
  summaryRecommendationAction: css`
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 16px;

    @media (max-width: 767px) {
      justify-content: space-between;
      padding-left: 48px;
    }

    @media (max-width: 420px) {
      align-items: stretch;
      flex-direction: column;
      padding-left: 0;
    }
  `,
  summaryRecommendationPrice: css`
    display: flex;
    align-items: baseline;
    color: ${token.colorTextHeading};
    font-size: 24px;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  `,
  summaryRecommendationPriceCycle: css`
    margin-left: 4px;
    color: ${token.colorTextSecondary};
    font-size: 12px;
    font-weight: normal;
  `,
  summaryRecommendationButton: css`
    min-width: 148px;
    font-size: ${token.fontSize}px;

    @media (max-width: 420px) {
      width: 100%;
    }
  `,
  comparisonLayout: css`
    scroll-margin-top: 24px;
  `,
  comparisonCard: css`
    overflow: hidden;
    border-color: ${token.colorBorderSecondary};
    box-shadow: 0 8px 30px color-mix(in srgb, ${token.colorText} 5%, transparent);

    .ant-card-body {
      padding: 0;
    }
  `,
  panelHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 22px 24px 18px;
    border-bottom: 1px solid ${token.colorBorderSecondary};

    @media (max-width: 575px) {
      align-items: stretch;
      flex-direction: column;
      gap: 10px;
      padding: 14px;
    }
  `,
  panelHeading: css`
    min-width: 0;
  `,
  panelTitle: css`
    color: ${token.colorTextHeading};
    font-size: 20px;
    font-weight: ${token.fontWeightStrong};
    line-height: 1.4;
  `,
  panelDescription: css`
    margin-top: 4px;
    color: ${token.colorTextTertiary};
    font-size: 13px;
    line-height: 1.5;
  `,
  billingControl: css`
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 8px;

    @media (max-width: 575px) {
      width: 100%;
      justify-content: space-between;
    }
  `,
  billingTitle: css`
    color: ${token.colorTextTertiary};
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  `,
  billingToggle: css`
    width: 196px;
    padding: 2px;
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillSecondary};

    .ant-segmented-item-label {
      min-height: 26px;
      padding-inline: 10px;
      font-size: 12px;
      line-height: 26px;
    }

    .ant-segmented-item-selected {
      box-shadow: 0 1px 3px color-mix(in srgb, ${token.colorText} 12%, transparent);
    }
  `,
  comparisonTableWrap: css`
    overflow-x: auto;
    margin: 20px 24px 0;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 16px;
    background: ${token.colorBgContainer};

    @media (max-width: 575px) {
      margin: 0;
      border-right: 0;
      border-left: 0;
      border-radius: 0;
    }
  `,
  comparisonTable: css`
    width: 100%;
    min-width: 900px;
    border-spacing: 0;
    border-collapse: separate;
    table-layout: fixed;

    th,
    td {
      padding: 13px 16px;
      border-bottom: 1px solid ${token.colorBorderSecondary};
      color: ${token.colorTextSecondary};
      font-size: ${token.fontSizeSM}px;
      line-height: 1.35;
      text-align: center;
      vertical-align: middle;
    }

    thead th {
      color: ${token.colorTextHeading};
      background: ${token.colorBgContainer};
      font-weight: ${token.fontWeightStrong};
    }

    tbody tr {
      transition: background-color 160ms cubic-bezier(0.23, 1, 0.32, 1);
    }

    @media (hover: hover) and (pointer: fine) {
      tbody tr:hover > th,
      tbody tr:hover > td {
        background: color-mix(in srgb, ${token.colorPrimaryBg} 18%, ${token.colorBgContainer});
      }
    }

    @media (max-width: 767px) {
      min-width: 900px;
    }
  `,
  capabilityHeaderCell: css`
    position: sticky;
    z-index: 4;
    left: 0;
    width: 186px;
    padding: 24px 18px !important;
    background: color-mix(in srgb, ${token.colorFillQuaternary} 72%, ${token.colorBgContainer}) !important;
    text-align: left !important;

    @media (max-width: 767px) {
      box-shadow: 1px 0 0 ${token.colorBorderSecondary};
    }
  `,
  capabilityCell: css`
    position: sticky;
    z-index: 2;
    left: 0;
    width: 186px;
    color: ${token.colorText} !important;
    background: ${token.colorBgContainer};
    font-weight: ${token.fontWeightStrong};
    text-align: left !important;

    @media (max-width: 767px) {
      box-shadow: 1px 0 0 ${token.colorBorderSecondary};
    }
  `,
  capabilityCellContent: css`
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;

    .anticon {
      display: inline-flex;
      width: 28px;
      height: 28px;
      flex: 0 0 28px;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      color: ${token.colorTextSecondary};
      background: ${token.colorFillQuaternary};
      font-size: 13px;
    }
  `,
  capabilityHeaderContent: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
  `,
  capabilityHeaderTitle: css`
    color: ${token.colorTextHeading};
    font-size: 15px;
    font-weight: ${token.fontWeightStrong};
  `,
  capabilityHeaderSubtitle: css`
    color: ${token.colorTextTertiary};
    font-size: 11px;
    font-weight: normal;
  `,
  planHeaderCell: css`
    --plan-accent: ${token.colorTextSecondary};
    --plan-accent-bg: ${token.colorFillSecondary};
    --plan-accent-contrast: ${token.colorTextLightSolid};

    position: relative;
    height: 188px;
    padding: 18px 14px 16px !important;
    vertical-align: top !important;

    &[data-plan-tone='blue'] {
      --plan-accent: ${token.colorPrimary};
      --plan-accent-bg: ${token.colorPrimaryBg};
    }

    &[data-plan-tone='orange'] {
      --plan-accent: #d97706;
      --plan-accent-bg: #fff7e6;
    }

    &[data-plan-tone='purple'] {
      --plan-accent: #7c3aed;
      --plan-accent-bg: #f3e8ff;
    }
  `,
  planHeaderContent: css`
    display: flex;
    min-height: 152px;
    flex-direction: column;
    align-items: center;
    gap: 9px;
    line-height: 1.3;
    white-space: nowrap;
  `,
  planIcon: css`
    display: inline-flex;
    width: 34px;
    height: 34px;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    font-size: 16px;

    &[data-tone='neutral'] {
      color: ${token.colorTextSecondary};
      background: ${token.colorFillSecondary};
    }

    &[data-tone='blue'] {
      color: ${token.colorPrimary};
      background: ${token.colorPrimaryBg};
    }

    &[data-tone='orange'] {
      color: #d97706;
      background: #fff7e6;
    }

    &[data-tone='purple'] {
      color: #7c3aed;
      background: #f3e8ff;
    }
  `,
  planName: css`
    color: ${token.colorTextHeading};
    font-size: 15px;
    font-weight: ${token.fontWeightStrong};
  `,
  planMarkerTag: css`
    position: absolute;
    z-index: 1;
    top: 12px;
    right: 12px;
    display: inline-flex;
    height: 20px;
    align-items: center;
    justify-content: center;
    margin-inline-end: 0;
    padding-inline: 7px;
    border: 0;
    border-radius: 999px;
    font-size: 10px;
    font-weight: ${token.fontWeightStrong};
    line-height: 20px;
    box-shadow: 0 2px 8px color-mix(in srgb, ${token.colorText} 10%, transparent);

    &[data-tone='current'] {
      color: var(--plan-accent-contrast);
      background: var(--plan-accent);
    }

    &[data-tone='recommended'] {
      color: var(--plan-accent-contrast);
      background: var(--plan-accent);
    }
  `,
  currentPlanColumn: css`
    box-shadow: inset 1px 0 color-mix(in srgb, var(--plan-accent) 28%, transparent), inset -1px 0 color-mix(in srgb, var(--plan-accent) 28%, transparent);
    background: color-mix(in srgb, var(--plan-accent-bg) 58%, ${token.colorBgContainer}) !important;
  `,
  currentPlanHeader: css`
    color: var(--plan-accent) !important;

    &::before {
      position: absolute;
      top: -1px;
      right: 18px;
      left: 18px;
      height: 3px;
      border-radius: 0 0 999px 999px;
      background: var(--plan-accent);
      content: '';
    }
  `,
  recommendedPlanColumn: css`
    background: color-mix(in srgb, var(--plan-accent-bg) 34%, ${token.colorBgContainer}) !important;
  `,
  recommendedPlanHeader: css`
    background: color-mix(in srgb, var(--plan-accent-bg) 50%, ${token.colorBgContainer}) !important;

    &::before {
      position: absolute;
      top: -1px;
      right: 18px;
      left: 18px;
      height: 3px;
      border-radius: 0 0 999px 999px;
      background: var(--plan-accent);
      content: '';
    }
  `,
  planDescription: css`
    display: -webkit-box;
    overflow: hidden;
    min-height: 34px;
    color: ${token.colorTextTertiary};
    font-size: 11px;
    font-weight: normal;
    line-height: 1.5;
    white-space: normal;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  `,
  planLimitValue: css`
    display: inline-block;
    color: ${token.colorText};
    font-size: 14px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  `,
  featureEnabled: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: ${token.colorSuccess};
    font-size: 18px;
    line-height: 1;
  `,
  featureDisabled: css`
    color: ${token.colorTextQuaternary};
    font-size: 13px;
    line-height: 1;
  `,
  tablePrice: css`
    display: flex;
    align-items: baseline;
    justify-content: center;
    margin-top: auto;
    color: var(--plan-accent);
    font-size: 20px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  `,
  tablePriceCycle: css`
    margin-left: 4px;
    color: ${token.colorTextTertiary};
    font-size: 11px;
    font-weight: normal;
    line-height: 1.2;
  `,
  tableAction: css`
    --plan-action-accent: ${token.colorPrimary};

    min-width: 126px;
    height: 34px;
    padding-inline: 14px;
    border-radius: ${token.borderRadius}px;
    font-size: 12px;
    font-weight: ${token.fontWeightStrong};
    box-shadow: 0 5px 14px color-mix(in srgb, var(--plan-action-accent) 22%, transparent);
    transition:
      transform 140ms cubic-bezier(0.23, 1, 0.32, 1),
      box-shadow 140ms cubic-bezier(0.23, 1, 0.32, 1);

    @media (hover: hover) and (pointer: fine) {
      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 8px 18px color-mix(in srgb, var(--plan-action-accent) 30%, transparent);
      }
    }

    &:active {
      transform: scale(0.97);
      box-shadow: 0 3px 9px color-mix(in srgb, var(--plan-action-accent) 20%, transparent);
    }

    &[data-tone='orange'] {
      --plan-action-accent: #d97706;
    }

    &[data-tone='purple'] {
      --plan-action-accent: #7c3aed;
    }
  `,
  tableActionStatus: css`
    display: inline-flex;
    min-width: 104px;
    height: 34px;
    align-items: center;
    justify-content: center;
    padding-inline: 10px;
    color: ${token.colorTextQuaternary};
    font-size: 11px;
    line-height: 1;
  `,
  tableActionPlaceholder: css`
    display: block;
    width: 126px;
    height: 34px;
  `,
  currentPlanPrice: css`
    color: var(--plan-accent);
  `,
  recommendedPlanPrice: css`
    color: var(--plan-accent);
  `,
  unavailablePlanPrice: css`
    color: ${token.colorTextSecondary};
    font-weight: 600;
  `,
  comparisonFootnote: css`
    padding: 12px 24px 18px;
    color: ${token.colorTextTertiary};
    font-size: 12px;
  `,
  capabilityGrid: css`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;

    @media (max-width: 1199px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 575px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  capabilityCard: css`
    height: 100%;
    border-color: ${token.colorBorderSecondary};
    box-shadow: ${token.boxShadowTertiary};

    .ant-card-body {
      display: flex;
      min-height: 180px;
      flex-direction: column;
      padding: 16px;
    }
  `,
  capabilityIcon: css`
    display: inline-flex;
    width: 44px;
    height: 44px;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    font-size: 23px;

    &[data-tone='green'] {
      color: ${token.colorSuccess};
      background: ${token.colorSuccessBg};
    }

    &[data-tone='blue'] {
      color: ${token.colorPrimary};
      background: ${token.colorPrimaryBg};
    }

    &[data-tone='purple'] {
      color: #7c3aed;
      background: #f3e8ff;
    }

    &[data-tone='orange'] {
      color: ${token.colorWarning};
      background: ${token.colorWarningBg};
    }
  `,
  capabilityTitle: css`
    margin: 12px 0 7px;
    color: ${token.colorTextHeading};
    font-size: ${token.fontSizeLG}px;
    font-weight: ${token.fontWeightStrong};
  `,
  capabilityDescription: css`
    margin: 0 !important;
    color: ${token.colorTextSecondary};
    font-size: 13px;
    line-height: 1.65;
  `,
  capabilityPoints: css`
    display: flex;
    flex-wrap: wrap;
    gap: 12px 18px;
    margin-top: auto;
    padding-top: 12px;
  `,
  capabilityPoint: css`
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: ${token.colorTextSecondary};
    font-size: 12px;
  `,
  capabilityPointIcon: css`
    width: 7px;
    height: 7px;
    flex: 0 0 auto;
    border-radius: 50%;
    background: ${token.colorPrimary};

    &[data-tone='green'] {
      background: ${token.colorSuccess};
    }

    &[data-tone='purple'] {
      background: #9333ea;
    }

    &[data-tone='orange'] {
      background: ${token.colorWarning};
    }
  `,
  subscriptionNotesCard: css`
    overflow: hidden;
    border-color: ${token.colorBorderSecondary};
    box-shadow: ${token.boxShadowTertiary};

    .ant-card-body {
      padding: 0;
    }
  `,
  subscriptionNotesHeader: css`
    padding: 13px 18px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
    color: ${token.colorTextHeading};
    font-size: ${token.fontSizeLG}px;
    font-weight: ${token.fontWeightStrong};
  `,
  subscriptionNotesGrid: css`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));

    @media (max-width: 1199px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 575px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  subscriptionNote: css`
    display: flex;
    min-height: 100px;
    align-items: flex-start;
    gap: 12px;
    padding: 14px;
    border-right: 1px solid ${token.colorBorderSecondary};

    &:last-child {
      border-right: 0;
    }

    @media (max-width: 1199px) {
      border-bottom: 1px solid ${token.colorBorderSecondary};

      &:nth-child(2n) {
        border-right: 0;
      }

      &:nth-last-child(-n + 2) {
        border-bottom: 0;
      }
    }

    @media (max-width: 575px) {
      min-height: auto;
      border-right: 0;

      &:nth-last-child(2) {
        border-bottom: 1px solid ${token.colorBorderSecondary};
      }

      &:last-child {
        border-bottom: 0;
      }
    }
  `,
  subscriptionNoteIcon: css`
    display: inline-flex;
    width: 36px;
    height: 36px;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
    font-size: 17px;
  `,
  subscriptionNoteTitle: css`
    display: block;
    margin-bottom: 5px;
    color: ${token.colorTextHeading};
    font-weight: ${token.fontWeightStrong};
  `,
  subscriptionNoteDescription: css`
    color: ${token.colorTextSecondary};
    font-size: 12px;
    line-height: 1.5;
  `,
  checkoutBody: css`
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-top: 2px;
  `,
  checkoutSummary: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};

    @media (max-width: 575px) {
      align-items: flex-start;
    }
  `,
  checkoutPlan: css`
    min-width: 0;
  `,
  checkoutPlanName: css`
    display: block;
    margin-bottom: 4px;
    color: ${token.colorTextHeading};
    font-weight: ${token.fontWeightStrong};
  `,
  checkoutOrderNo: css`
    display: block;
    max-width: 220px;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
    font-family: ${token.fontFamilyCode};

    @media (max-width: 575px) {
      max-width: 180px;
    }
  `,
  checkoutAmountBlock: css`
    flex: 0 0 auto;
    text-align: right;
  `,
  checkoutAmountLabel: css`
    display: block;
    margin-bottom: 2px;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
  `,
  checkoutAmountValue: css`
    color: ${token.colorTextHeading};
    font-size: 22px;
    font-weight: 700;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
  `,
  qrSection: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2px 0;
  `,
  qrFrame: css`
    display: inline-flex;
    margin: 0 auto 12px;
    padding: 10px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: #fff;
    box-shadow: ${token.boxShadowTertiary};
  `,
  qrImage: css`
    display: block;
    width: 196px;
    height: 196px;
  `,
  qrTitle: css`
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 4px;
    color: ${token.colorTextHeading};
    font-weight: ${token.fontWeightStrong};
  `,
  wechatIcon: css`
    color: #07c160;
    font-size: 18px;
  `,
  qrHint: css`
    display: block;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
  `,
  checkoutNotice: css`
    .ant-alert-title {
      font-size: ${token.fontSizeSM}px;
      font-weight: normal;
    }
  `,
  checkoutAction: css`
    transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1);

    &:active {
      transform: scale(0.98);
    }
  `,
}));

function formatAmount(amount: number) {
  return `¥${(amount / 100).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPriceValue(amount: number) {
  return (amount / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

function formatCompactDate(value?: string | null) {
  if (!value) return '长期有效';
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function remainingDays(value?: string | null) {
  if (!value) return null;
  return Math.max(
    0,
    Math.ceil((new Date(value).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );
}

function subscriptionRemainingPercent(
  startsAt?: string | null,
  endsAt?: string | null,
) {
  if (!startsAt || !endsAt) return 100;
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (end <= start) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round(((end - Date.now()) / (end - start)) * 100)),
  );
}

function formatLimit(limit?: number | null) {
  return limit == null ? '不限' : limit.toLocaleString('zh-CN');
}

function formatPlanLimit(limit: number | null | undefined, unit: string) {
  return limit == null ? '不限' : `${limit.toLocaleString('zh-CN')} ${unit}`;
}

function billingCycleLabel(cycle?: string) {
  return cycle === 'year' ? '年付' : '月付';
}

function usagePercent(used: number, limit?: number | null) {
  if (limit == null || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function usageProgressColor(
  percent: number,
  token: { primary: string; warning: string; error: string },
) {
  if (percent >= 90) return token.error;
  if (percent >= 75) return token.warning;
  return token.primary;
}

function subscriptionStatusMeta(subscription: CurrentSubscription | null) {
  if (!subscription) {
    return { color: 'blue', icon: <CheckCircleFilled />, label: '基础套餐' };
  }
  return (
    {
      trialing: {
        color: 'purple',
        icon: <ClockCircleOutlined />,
        label: '试用中',
      },
      active: {
        color: 'blue',
        icon: <CheckCircleFilled />,
        label: '服务中',
      },
      ended: { color: 'default', icon: <StopOutlined />, label: '已结束' },
    }[subscription.status || ''] || {
      color: 'blue',
      icon: <CheckCircleFilled />,
      label: '服务中',
    }
  );
}

const SubscriptionPage: React.FC = () => {
  const { styles, theme } = useStyles();
  const workspace = useTenantWorkspace();
  const [billingCycle, setBillingCycle] = useState<'month' | 'year'>('month');
  const [checkoutCodeUrl, setCheckoutCodeUrl] = useState<string>();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutOrderNo, setCheckoutOrderNo] = useState<string>();
  const [completedOrderNo, setCompletedOrderNo] = useState<string>();
  const currentQuery = useQuery({
    queryKey: ['subscriptions', 'current', workspace.selectedOrgSlug],
    queryFn: appsSubscriptionsApiCurrentSubscription,
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const plansQuery = useQuery({
    queryKey: ['subscriptions', 'plans'],
    queryFn: appsSubscriptionsApiListPlans,
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const checkoutOrderQuery = useQuery({
    queryKey: [
      'subscriptions',
      'order',
      workspace.selectedOrgSlug,
      checkoutOrderNo,
    ],
    queryFn: () =>
      appsSubscriptionsApiGetOrder({ order_no: checkoutOrderNo || '' }),
    enabled: Boolean(checkoutOrderNo),
    refetchInterval: (query) =>
      query.state.data?.status === 'pending_payment' ? 2000 : false,
  });

  const purchaseMutation = useMutation({
    mutationFn: (payload: API.PurchaseOrderIn) =>
      appsSubscriptionsApiCreateOrder(payload),
    onSuccess: async (order) => {
      const checkout = order.payment?.checkout as
        | { code_url?: string }
        | undefined;
      setCheckoutCodeUrl(checkout?.code_url);
      setCheckoutOrderNo(order.order_no);
      if (checkout?.code_url) {
        setCheckoutOpen(true);
      } else {
        message.warning(
          '订单已创建，但收银台尚未启用微信支付配置，请联系平台管理员后重新发起订单。',
        );
      }
      await workspace.queryClient.invalidateQueries({
        queryKey: ['subscriptions', 'orders', workspace.selectedOrgSlug],
      });
    },
  });

  useEffect(() => {
    const activeCycle = (currentQuery.data?.subscription as CurrentSubscription)
      ?.billing_cycle;
    if (activeCycle === 'month' || activeCycle === 'year')
      setBillingCycle(activeCycle);
  }, [currentQuery.data?.subscription]);

  useEffect(() => {
    if (
      checkoutOrderQuery.data?.status !== 'paid' ||
      !checkoutOrderNo ||
      checkoutOrderNo === completedOrderNo
    )
      return;
    setCompletedOrderNo(checkoutOrderNo);
    setCheckoutOpen(false);
    message.success('支付成功，套餐权益已开通。');
    void Promise.all([
      workspace.queryClient.invalidateQueries({
        queryKey: ['subscriptions', 'current', workspace.selectedOrgSlug],
      }),
      workspace.queryClient.invalidateQueries({
        queryKey: ['subscriptions', 'orders', workspace.selectedOrgSlug],
      }),
    ]);
  }, [
    checkoutOrderNo,
    checkoutOrderQuery.data?.status,
    completedOrderNo,
    workspace.queryClient,
    workspace.selectedOrgSlug,
  ]);

  const currentPlanCode = String(currentQuery.data?.plan?.code || 'free');
  const currentPlanName = String(currentQuery.data?.plan?.name || '免费版');
  const plans = useMemo(
    () =>
      [...(plansQuery.data || [])].sort(
        (left, right) => left.display_order - right.display_order,
      ),
    [plansQuery.data],
  );
  const currentPlan = plans.find((plan) => plan.code === currentPlanCode);
  const currentPlanOrder = currentPlan?.display_order ?? 0;
  const upgradeRecommendation = (
    currentQuery.data as
      | (API.CurrentSubscriptionOut & {
          recommendation?: UpgradeRecommendation | null;
        })
      | undefined
  )?.recommendation;
  const recommendedPlan = plans.find(
    (plan) => plan.code === upgradeRecommendation?.target_plan_code,
  );
  const entitlement = (currentQuery.data?.entitlement || {}) as Entitlement;
  const usage = (currentQuery.data?.usage || {}) as Usage;
  const currentSubscription = (currentQuery.data?.subscription ||
    null) as CurrentSubscription | null;
  const currentStatus = subscriptionStatusMeta(currentSubscription);
  const checkoutPlan = plans.find(
    (plan) => plan.code === purchaseMutation.variables?.target_plan_code,
  );
  const checkoutAmount =
    checkoutOrderQuery.data?.payable_amount ??
    purchaseMutation.data?.payable_amount;
  const expiresAt = currentSubscription?.ends_at || entitlement.ends_at;
  const daysLeft = remainingDays(expiresAt);
  const resourceUsageItems = [
    {
      key: 'member',
      label: '成员席位',
      used: usage.member || 0,
      limit: entitlement.member_limit,
      icon: <TeamOutlined />,
    },
    {
      key: 'team',
      label: '团队数量',
      used: usage.team || 0,
      limit: entitlement.team_limit,
      icon: <ApartmentOutlined />,
    },
    {
      key: 'house',
      label: '房源容量',
      used: usage.house || 0,
      limit: entitlement.house_limit,
      icon: <AppIcon name="house" />,
    },
  ];
  const usageItems = [
    ...resourceUsageItems.map((item) => {
      const percent = usagePercent(item.used, item.limit);
      const remaining =
        item.limit == null ? null : Math.max(0, item.limit - item.used);
      return {
        key: item.key,
        label: item.label,
        icon: item.icon,
        value: item.used.toLocaleString('zh-CN'),
        limitLabel: `/ ${formatLimit(item.limit)}`,
        percent,
        note:
          remaining == null
            ? '当前额度不限'
            : `剩余 ${remaining.toLocaleString('zh-CN')}`,
        progressColor: usageProgressColor(percent, {
          primary: theme.colorPrimary,
          warning: theme.colorWarning,
          error: theme.colorError,
        }),
      };
    }),
    {
      key: 'period',
      label: '剩余周期',
      icon: <CalendarOutlined />,
      value: daysLeft == null ? '长期' : daysLeft.toLocaleString('zh-CN'),
      limitLabel: daysLeft == null ? '' : '天',
      percent: subscriptionRemainingPercent(
        currentSubscription?.starts_at,
        expiresAt,
      ),
      note: expiresAt ? `至 ${formatCompactDate(expiresAt)}` : '长期有效',
      progressColor: theme.colorPrimary,
    },
  ];
  const currentPlanEntitlement = (currentPlan?.entitlement ||
    entitlement) as Entitlement;
  const currentFeatures = currentPlanEntitlement.feature_flags || {};
  const recommendedEntitlement = (recommendedPlan?.entitlement ||
    {}) as Entitlement;
  const recommendedPrices = (recommendedPlan?.prices || []) as PlanPrice[];
  const recommendedPrice = recommendedPrices.find(
    (price) => price.billing_cycle === billingCycle,
  );
  const recommendedAmount = Number(recommendedPrice?.amount || 0);
  const recommendedFeatureKeys = Object.entries(
    recommendedEntitlement.feature_flags || {},
  )
    .filter(([feature, enabled]) => enabled && !currentFeatures[feature])
    .map(([feature]) => feature);
  const recommendedPoints = [
    recommendedEntitlement.member_limit != null &&
    recommendedEntitlement.member_limit !== entitlement.member_limit
      ? `成员席位提升至 ${formatPlanLimit(recommendedEntitlement.member_limit, '人')}`
      : null,
    ...recommendedFeatureKeys.map(
      (feature) => `新增${FEATURE_LABELS[feature] || feature}`,
    ),
    recommendedEntitlement.house_limit != null &&
    recommendedEntitlement.house_limit !== entitlement.house_limit
      ? `房源容量提升至 ${formatPlanLimit(recommendedEntitlement.house_limit, '套')}`
      : null,
    recommendedEntitlement.team_limit != null &&
    recommendedEntitlement.team_limit !== entitlement.team_limit
      ? `团队数量提升至 ${formatPlanLimit(recommendedEntitlement.team_limit, '个')}`
      : null,
  ].filter((point): point is string => Boolean(point));

  return (
    <TenantSelectionGuard title="套餐与用量">
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <Typography.Title level={2} className={styles.pageTitle}>
              套餐与用量管理
            </Typography.Title>
            <Typography.Paragraph className={styles.pageDescription}>
              统一查看当前订阅、资源使用与升级方案，帮助团队按规模高效增长。
            </Typography.Paragraph>
          </div>
          <div className={styles.pageActions}>
            <Button
              type="primary"
              size="large"
              icon={<ArrowRightOutlined />}
              iconPlacement="end"
              onClick={() =>
                document
                  .getElementById('plan-catalog')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            >
              续费 / 升级
            </Button>
            <Button
              size="large"
              icon={<FileTextOutlined />}
              onClick={() => history.push(SPACE_PATHS.subscriptionOrders)}
            >
              购买记录
            </Button>
          </div>
        </header>

        <Card className={styles.summaryCard} loading={currentQuery.isLoading}>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryOverview}>
              <ApartmentOutlined className={styles.summaryDecoration} />
              <span className={styles.currentBadge}>当前套餐</span>
              <div className={styles.planTitleRow}>
                <Typography.Title level={2} className={styles.currentPlanTitle}>
                  {currentPlanName}
                </Typography.Title>
                <Tag color={currentStatus.color} icon={currentStatus.icon}>
                  {currentStatus.label}
                </Tag>
              </div>
              <Typography.Paragraph className={styles.summaryDescription}>
                {PLAN_FALLBACK_DESCRIPTIONS[currentPlanCode] ||
                  '当前套餐权益已应用到此空间。'}
              </Typography.Paragraph>
              <div className={styles.summaryMeta}>
                <span className={styles.summaryMetaItem}>
                  <WalletOutlined />
                  {currentSubscription
                    ? billingCycleLabel(currentSubscription.billing_cycle)
                    : '免费使用'}
                </span>
                <span className={styles.summaryMetaItem}>
                  <ClockCircleOutlined />
                  有效期至 {formatCompactDate(expiresAt)}
                </span>
              </div>
            </div>
            <div className={styles.usageSide}>
              <ul className={styles.usagePanel} aria-label="当前套餐用量">
                {usageItems.map((item) => (
                  <li className={styles.usageCard} key={item.key}>
                    <div className={styles.usageTopRow}>
                      <div className={styles.usageHeader}>
                        <span className={styles.usageIcon}>{item.icon}</span>
                        <span className={styles.usageLabel}>{item.label}</span>
                      </div>
                      <div className={styles.usageValue}>
                        {item.value}
                        {item.limitLabel && (
                          <span className={styles.usageLimit}>
                            {item.limitLabel}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.usageProgressRow}>
                      <Progress
                        percent={item.percent}
                        showInfo={false}
                        size="small"
                        strokeColor={item.progressColor}
                      />
                    </div>
                    <div className={styles.usageFooter}>
                      <span className={styles.usageNote}>{item.note}</span>
                      <span className={styles.usagePercent}>
                        {item.percent}%
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {recommendedPlan && (
            <div className={styles.summaryRecommendation}>
              <div className={styles.summaryRecommendationMain}>
                <span className={styles.summaryRecommendationIcon}>
                  <ThunderboltOutlined />
                </span>
                <div className={styles.summaryRecommendationContent}>
                  <span className={styles.summaryRecommendationEyebrow}>
                    升级建议
                  </span>
                  <Typography.Title
                    level={4}
                    className={styles.summaryRecommendationTitle}
                  >
                    推荐升级到{recommendedPlan.name}
                  </Typography.Title>
                  <div className={styles.summaryRecommendationPoints}>
                    {recommendedPoints.slice(0, 3).map((point) => (
                      <span
                        className={styles.summaryRecommendationPoint}
                        key={point}
                      >
                        <CheckOutlined />
                        {point}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className={styles.summaryRecommendationAction}>
                <div className={styles.summaryRecommendationPrice}>
                  ¥{formatPriceValue(recommendedAmount)}
                  <span className={styles.summaryRecommendationPriceCycle}>
                    /{billingCycle === 'year' ? '年' : '月'}
                  </span>
                </div>
                <Button
                  type="primary"
                  size="large"
                  className={styles.summaryRecommendationButton}
                  disabled={!recommendedPrice}
                  loading={purchaseMutation.isPending}
                  aria-label={`推荐升级 ${recommendedPlan.name}（${billingCycleLabel(billingCycle)}） ${formatAmount(recommendedAmount)}`}
                  onClick={() =>
                    purchaseMutation.mutate({
                      target_plan_code: recommendedPlan.code,
                      billing_cycle: billingCycle,
                      payment_mode: 'native',
                    })
                  }
                >
                  升级至{recommendedPlan.name}
                </Button>
              </div>
            </div>
          )}
        </Card>

        <section id="plan-catalog" className={styles.comparisonLayout}>
          <Card
            className={styles.comparisonCard}
            loading={plansQuery.isLoading}
          >
            <div className={styles.panelHeader}>
              <div className={styles.panelHeading}>
                <div className={styles.panelTitle}>版本权益对比</div>
                <div className={styles.panelDescription}>
                  对比不同套餐的资源额度与核心能力
                </div>
              </div>
              <div className={styles.billingControl}>
                <span className={styles.billingTitle}>计费周期</span>
                <Segmented
                  block
                  size="small"
                  className={styles.billingToggle}
                  value={billingCycle}
                  onChange={(value) =>
                    setBillingCycle(value as 'month' | 'year')
                  }
                  options={[
                    { label: '月付', value: 'month' },
                    { label: '年付 · 优惠', value: 'year' },
                  ]}
                />
              </div>
            </div>
            <div className={styles.comparisonTableWrap}>
              <table
                className={styles.comparisonTable}
                aria-label="套餐版本权益对比"
              >
                <thead>
                  <tr>
                    <th scope="col" className={styles.capabilityHeaderCell}>
                      <span className={styles.capabilityHeaderContent}>
                        <span className={styles.capabilityHeaderTitle}>
                          权益能力
                        </span>
                        <span className={styles.capabilityHeaderSubtitle}>
                          各版本包含内容
                        </span>
                      </span>
                    </th>
                    {plans.map((plan) => {
                      const prices = (plan.prices || []) as PlanPrice[];
                      const selectedPrice = prices.find(
                        (price) => price.billing_cycle === billingCycle,
                      );
                      const amount = Number(selectedPrice?.amount || 0);
                      const isCurrent = plan.code === currentPlanCode;
                      const isRecommended = plan.code === recommendedPlan?.code;
                      const lowerPlan =
                        plan.display_order < currentPlanOrder ||
                        plan.code === 'free';
                      const disabled = isCurrent || lowerPlan || !selectedPrice;
                      const actionLabel = isCurrent
                        ? '当前使用'
                        : lowerPlan
                          ? '不可降级'
                          : !selectedPrice
                            ? '暂不可用'
                            : `升级至${plan.name}`;
                      const presentation = PLAN_PRESENTATIONS[plan.code] || {
                        icon: <ApartmentOutlined />,
                        tone: 'neutral' as const,
                      };
                      return (
                        <th
                          scope="col"
                          key={plan.code}
                          data-plan-tone={presentation.tone}
                          className={`${styles.planHeaderCell} ${isCurrent ? `${styles.currentPlanColumn} ${styles.currentPlanHeader}` : ''} ${isRecommended ? `${styles.recommendedPlanColumn} ${styles.recommendedPlanHeader}` : ''}`}
                        >
                          <div className={styles.planHeaderContent}>
                            <span
                              className={styles.planIcon}
                              data-tone={presentation.tone}
                            >
                              {presentation.icon}
                            </span>
                            <span className={styles.planName}>{plan.name}</span>
                            {isCurrent ? (
                              <Tag
                                className={styles.planMarkerTag}
                                data-tone="current"
                              >
                                当前使用
                              </Tag>
                            ) : isRecommended ? (
                              <Tag
                                className={styles.planMarkerTag}
                                data-tone="recommended"
                              >
                                推荐
                              </Tag>
                            ) : null}
                            <span className={styles.planDescription}>
                              {plan.description ||
                                PLAN_FALLBACK_DESCRIPTIONS[plan.code] ||
                                '按业务阶段灵活选择适合的套餐。'}
                            </span>
                            <div
                              className={`${styles.tablePrice} ${isCurrent ? styles.currentPlanPrice : ''} ${isRecommended ? styles.recommendedPlanPrice : ''} ${lowerPlan && !isCurrent ? styles.unavailablePlanPrice : ''}`}
                            >
                              ¥{formatPriceValue(amount)}
                              <span className={styles.tablePriceCycle}>
                                /{billingCycle === 'year' ? '年' : '月'}
                              </span>
                            </div>
                            {isCurrent ? (
                              <span
                                className={styles.tableActionPlaceholder}
                                aria-hidden="true"
                              />
                            ) : disabled ? (
                              <span className={styles.tableActionStatus}>
                                {actionLabel}
                              </span>
                            ) : (
                              <Button
                                className={styles.tableAction}
                                data-tone={presentation.tone}
                                size="small"
                                color={
                                  presentation.tone === 'orange'
                                    ? 'orange'
                                    : presentation.tone === 'purple'
                                      ? 'purple'
                                      : 'primary'
                                }
                                variant="solid"
                                icon={<ArrowRightOutlined />}
                                iconPlacement="end"
                                loading={purchaseMutation.isPending}
                                aria-label={`开通 ${plan.name}（${billingCycleLabel(billingCycle)}） ${formatAmount(amount)}`}
                                onClick={() =>
                                  purchaseMutation.mutate({
                                    target_plan_code: plan.code,
                                    billing_cycle: billingCycle,
                                    payment_mode: 'native',
                                  })
                                }
                              >
                                {actionLabel}
                              </Button>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row) => (
                    <tr key={row.key}>
                      <th scope="row" className={styles.capabilityCell}>
                        <span className={styles.capabilityCellContent}>
                          {row.icon}
                          {row.label}
                        </span>
                      </th>
                      {plans.map((plan) => {
                        const planEntitlement = (plan.entitlement ||
                          {}) as Entitlement;
                        const isCurrent = plan.code === currentPlanCode;
                        const isRecommended =
                          plan.code === recommendedPlan?.code;
                        const limit =
                          row.key === 'member_limit'
                            ? planEntitlement.member_limit
                            : row.key === 'team_limit'
                              ? planEntitlement.team_limit
                              : planEntitlement.house_limit;
                        const enabled = Boolean(
                          planEntitlement.feature_flags?.[row.key],
                        );
                        return (
                          <td
                            key={`${row.key}-${plan.code}`}
                            className={`${isCurrent ? styles.currentPlanColumn : ''} ${isRecommended ? styles.recommendedPlanColumn : ''}`}
                          >
                            {row.type === 'limit' ? (
                              <span className={styles.planLimitValue}>
                                {formatPlanLimit(limit, row.unit)}
                              </span>
                            ) : enabled ? (
                              <CheckCircleFilled
                                aria-label="支持"
                                className={styles.featureEnabled}
                              />
                            ) : (
                              <span className={styles.featureDisabled}>—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.comparisonFootnote}>
              * 年付方案可享对应优惠，具体金额以当前计费周期显示为准。
            </div>
          </Card>
        </section>

        <section className={styles.capabilityGrid}>
          {PRODUCT_CAPABILITIES.map((capability) => (
            <Card className={styles.capabilityCard} key={capability.key}>
              <span
                className={styles.capabilityIcon}
                data-tone={capability.tone}
              >
                {capability.icon}
              </span>
              <div className={styles.capabilityTitle}>{capability.title}</div>
              <Typography.Paragraph className={styles.capabilityDescription}>
                {capability.description}
              </Typography.Paragraph>
              <div className={styles.capabilityPoints}>
                {capability.points.map((point) => (
                  <span className={styles.capabilityPoint} key={point}>
                    <span
                      className={styles.capabilityPointIcon}
                      data-tone={capability.tone}
                    />
                    {point}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </section>

        <Card className={styles.subscriptionNotesCard}>
          <div className={styles.subscriptionNotesHeader}>订阅说明</div>
          <div className={styles.subscriptionNotesGrid}>
            {SUBSCRIPTION_NOTES.map((note) => (
              <div className={styles.subscriptionNote} key={note.key}>
                <span className={styles.subscriptionNoteIcon}>{note.icon}</span>
                <div>
                  <span className={styles.subscriptionNoteTitle}>
                    {note.title}
                  </span>
                  <span className={styles.subscriptionNoteDescription}>
                    {note.description}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Modal
          title="微信扫码支付"
          open={checkoutOpen}
          onCancel={() => setCheckoutOpen(false)}
          footer={null}
          width={400}
          centered
          destroyOnHidden
          mask={{ closable: false }}
        >
          <div className={styles.checkoutBody}>
            <div className={styles.checkoutSummary}>
              <div className={styles.checkoutPlan}>
                <span className={styles.checkoutPlanName}>
                  {checkoutPlan?.name || '套餐订阅'} ·{' '}
                  {billingCycleLabel(purchaseMutation.variables?.billing_cycle)}
                </span>
                <Typography.Text
                  className={styles.checkoutOrderNo}
                  ellipsis={{ tooltip: checkoutOrderNo }}
                >
                  订单号 {checkoutOrderNo}
                </Typography.Text>
              </div>
              <div className={styles.checkoutAmountBlock}>
                <span className={styles.checkoutAmountLabel}>应付金额</span>
                <span className={styles.checkoutAmountValue}>
                  {checkoutAmount != null ? formatAmount(checkoutAmount) : '—'}
                </span>
              </div>
            </div>
            <div className={styles.qrSection}>
              {checkoutCodeUrl && (
                <div className={styles.qrFrame}>
                  <img
                    alt="微信支付二维码"
                    src={`/qr/?data=${encodeURIComponent(checkoutCodeUrl)}`}
                    className={styles.qrImage}
                  />
                </div>
              )}
              <div className={styles.qrTitle}>
                <WechatOutlined className={styles.wechatIcon} />
                打开微信扫一扫
              </div>
              <span className={styles.qrHint}>请在二维码有效期内完成支付</span>
            </div>
            <Alert
              className={styles.checkoutNotice}
              type="info"
              showIcon
              title="支付完成后页面会自动同步，请勿重复创建订单。"
            />
            <Button
              className={styles.checkoutAction}
              block
              onClick={() => setCheckoutOpen(false)}
            >
              稍后支付
            </Button>
          </div>
        </Modal>
      </div>
    </TenantSelectionGuard>
  );
};

export default SubscriptionPage;
