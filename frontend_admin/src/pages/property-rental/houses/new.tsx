import { createStyles } from 'antd-style';
import { useMutation, useQuery } from '@tanstack/react-query';
import { history } from '@umijs/max';
import { Alert, Button, Card, Col, Descriptions, Form, Input, Modal, Row, Select, Space, Steps, Tag, Typography, message } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi, type ContactOut } from '@/services/manual/house';
import { appsSettingsApiListOrgSettings } from '@/services/openapi/organizationSettings';
import {
  HOUSE_PUBLISH_RULE_LABELS,
  normalizeHousePublishRules,
  summarizeHousePublishRules,
} from '../publish-rules';
import MediaRefsUpload from '../components/MediaRefsUpload';
import {
  buildingLabel,
  CONTACT_ROLE,
  contactLabel,
  evaluateHousePublishState,
  getHouseMediaCompleteness,
  HOUSE_DECORATION_OPTIONS,
  HOUSE_MEDIA_RESOURCE_TYPE,
  HOUSE_MEDIA_TYPE,
  HOUSE_ORIENTATION_OPTIONS,
  moneyText,
  type MediaRefValue,
} from '../constants';

const STEP_ITEMS = [
  { title: '建档' },
  { title: '补充资料' },
  { title: '媒体资料' },
  { title: '确认保存' },
];

const STEP_FIELDS: string[][] = [
  ['building_id', 'room_number'],
  [],
  [],
  [],
];

type HouseWizardFormValues = Record<string, unknown> & {
  asking_rent?: string | number | null;
  available_from?: string | null;
  building_id?: number | null;
  images?: MediaRefValue[];
  landlord_id?: number | null;
  room_number?: string;
  videos?: MediaRefValue[];
};

type HouseLifecycleSignal = {
  key: string;
  title: string;
  status: string;
  summary: string;
};

type StepFocus = {
  title: string;
  description: string;
  items: string[];
  tone: 'default' | 'warning' | 'success' | 'info';
};

const publishRulesSettingKey = 'property_rental.publish_rules';

const STEP_INTRO = [
  '先建出可保存草稿，再决定要不要继续往下补。',
  '优先补齐会影响带看、报价和签约交接的关键字段。',
  '媒体决定展示质量，是否阻断发布以当前空间规则为准。',
  '保存前确认缺口，避免把后续动作留给下一位同事猜。',
];

const useStyles = createStyles(({ token, css }) => ({
  metricPanel: css`
    height: 100%;
    padding: 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
  `,
  metricValue: css`
    margin: 8px 0 4px;
    font-size: 24px;
    line-height: 1.2;
    font-weight: 600;
  `,
  sectionBlock: css`
    padding: 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
  `,
  sectionHeader: css`
    margin-bottom: 16px;
  `,
  sidebar: css`
    padding: 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};

    @media (min-width: ${token.screenXL}px) {
      position: sticky;
      top: 24px;
    }
  `,
  sidebarBlock: css`
    &:not(:last-child) {
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid ${token.colorBorderSecondary};
    }
  `,
  footerActions: css`
    margin-top: 24px;
  `,
}));

function hasValue(value: unknown) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function getMissingFields(values: HouseWizardFormValues, fields: Array<{ key: keyof HouseWizardFormValues; label: string }>) {
  return fields.filter((item) => !hasValue(values[item.key])).map((item) => item.label);
}

function getWizardReadiness(values: HouseWizardFormValues, publishRules?: unknown) {
  const publishState = evaluateHousePublishState(values, publishRules);
  const draftMissing = getMissingFields(values, [
    { key: 'building_id', label: '楼栋' },
    { key: 'room_number', label: '房号' },
  ]);
  const viewingMissing = getMissingFields(values, [
    { key: 'landlord_id', label: '房东' },
    { key: 'asking_rent', label: '挂牌租金' },
    { key: 'available_from', label: '可租日期' },
  ]);
  return {
    draftMissing,
    draftReady: !draftMissing.length,
    publishBlockingIssues: publishState.blockingIssues,
    publishWarningIssues: publishState.warningIssues,
    publishIssues: [...publishState.blockingIssues, ...publishState.warningIssues],
    publishReady: publishState.canPublish,
    viewingMissing,
    viewingReady: !viewingMissing.length,
  };
}

function getStepAlert(currentStep: number, readiness: ReturnType<typeof getWizardReadiness>) {
  if (currentStep === 0) {
    return readiness.draftReady
      ? { type: 'success' as const, title: '已具备草稿保存门槛', description: '楼栋与房号已经齐备，随时可以继续补资料或先保存草稿。' }
      : { type: 'info' as const, title: '先完成最小建档', description: '当前只要求楼栋和房号，先把草稿建起来，后续资料再逐步补齐。' };
  }

  if (currentStep === 1) {
    return readiness.viewingReady
      ? { type: 'success' as const, title: '已满足带看基础', description: '房东、挂牌租金和可租日期都已齐备，后续交给运营安排带看会更顺。' }
      : {
          type: 'warning' as const,
          title: '带看资料仍待补齐',
          description: `建议至少补齐 ${readiness.viewingMissing.join('、')}，避免保存后还要来回追资料。`,
        };
  }

  if (currentStep === 2) {
    if (readiness.publishReady && readiness.publishWarningIssues.length) {
      return {
        type: 'info' as const,
        title: '当前可发布，但还有提醒项',
        description: `当前规则下不阻断发布，建议继续补齐 ${readiness.publishWarningIssues.join('、')}。`,
      };
    }
    return readiness.publishReady
      ? { type: 'success' as const, title: '媒体与基础资料已通过发布检查', description: '保存后可以直接进入发布流程，也方便运营马上承接带看。' }
      : {
          type: 'warning' as const,
          title: '发布检查仍有缺口',
          description: `当前还差 ${readiness.publishBlockingIssues.join('、')}，保存后建议先去详情页补齐。`,
        };
  }

  if (readiness.publishReady && readiness.publishWarningIssues.length) {
    return {
      type: 'info' as const,
      title: '保存后可直接进入发布流程',
      description: `当前阻断项已清空，但仍建议继续补齐 ${readiness.publishWarningIssues.join('、')}。`,
    };
  }

  return readiness.publishReady
    ? { type: 'success' as const, title: '保存后可直接进入发布流程', description: '当前资料已经比较完整，房源详情页主要用于后续状态维护。' }
    : {
        type: 'warning' as const,
        title: '保存后仍会停留在草稿流转',
        description: `建议按阻断项继续补齐：${readiness.publishBlockingIssues.join('、')}。`,
      };
}

function getInitialWizardStep(search: string) {
  const params = new URLSearchParams(search);
  const stepValue = Number(params.get('step') || '0');
  if (!Number.isFinite(stepValue)) return 0;
  return Math.min(Math.max(stepValue, 0), STEP_ITEMS.length - 1);
}

function syncWizardStepSearch(step: number) {
  const params = new URLSearchParams(window.location.search);
  if (step > 0) {
    params.set('step', String(step));
  } else {
    params.delete('step');
  }
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

function houseLayoutText(values: Record<string, unknown>) {
  const layout = [
    { key: 'bedrooms', label: '室' },
    { key: 'living_rooms', label: '厅' },
    { key: 'bathrooms', label: '卫' },
    { key: 'kitchens', label: '厨' },
    { key: 'balconies', label: '阳台' },
  ]
    .map((item) => values[item.key])
    .filter((value) => value !== undefined && value !== null && value !== '');

  if (!layout.length) return '-';

  return [
    `${values.bedrooms || 0}室`,
    `${values.living_rooms || 0}厅`,
    `${values.bathrooms || 0}卫`,
    `${values.kitchens || 0}厨`,
    `${values.balconies || 0}阳台`,
  ].join(' / ');
}

function getGapChecklist(readiness: ReturnType<typeof getWizardReadiness>) {
  return [
    ...readiness.draftMissing.map((item) => ({ key: `draft-${item}`, label: item, category: '草稿必补' })),
    ...readiness.viewingMissing.map((item) => ({ key: `viewing-${item}`, label: item, category: '带看前补' })),
    ...readiness.publishBlockingIssues.map((item) => ({ key: `publish-blocking-${item}`, label: item, category: '阻断发布' })),
    ...readiness.publishWarningIssues.map((item) => ({ key: `publish-warning-${item}`, label: item, category: '发布提醒' })),
  ];
}

function getStepFocus(currentStep: number, readiness: ReturnType<typeof getWizardReadiness>, gapChecklist: ReturnType<typeof getGapChecklist>): StepFocus {
  if (currentStep === 0) {
    return readiness.draftReady
      ? {
          title: '当前已满足草稿保存门槛',
          description: '可以现在就保存草稿，后续再去详情页继续补充带看和发布资料。',
          items: [],
          tone: 'success',
        }
      : {
          title: '当前步骤必须补齐',
          description: '先把最小建档补齐，避免后面的资料录入没有可承接的房源草稿。',
          items: readiness.draftMissing,
          tone: 'warning',
        };
  }

  if (currentStep === 1) {
    return readiness.viewingMissing.length
      ? {
          title: '带看前仍建议补齐',
          description: '这些字段不阻止保存草稿，但会直接影响后续带看、报价和交接效率。',
          items: readiness.viewingMissing,
          tone: 'info',
        }
      : {
          title: '带看基础已补齐',
          description: '房东、挂牌租金和可租日期都已具备，后续交给带看同事会更顺。',
          items: [],
          tone: 'success',
        };
  }

  if (currentStep === 2) {
    const items = [...readiness.publishBlockingIssues, ...readiness.publishWarningIssues];
    return items.length
      ? {
          title: readiness.publishBlockingIssues.length ? '发布前仍有阻断项' : '当前只有发布提醒项',
          description: readiness.publishBlockingIssues.length
            ? '这些问题会阻断发布，保存后建议优先去详情页继续补齐。'
            : '当前规则下不阻断发布，但建议继续补齐展示素材。',
          items,
          tone: readiness.publishBlockingIssues.length ? 'warning' : 'info',
        }
      : {
          title: '媒体与基础资料已通过检查',
          description: '保存后可以直接进入发布流程，运营也能马上承接后续动作。',
          items: [],
          tone: 'success',
        };
  }

  return gapChecklist.length
    ? {
        title: '保存后仍需继续跟进',
        description: '这些缺口不会因为保存自动消失，建议保存后按优先级继续处理。',
        items: [],
        tone: readiness.publishBlockingIssues.length ? 'warning' : 'info',
      }
    : {
        title: '当前可以直接进入详情承接',
        description: '草稿、带看和发布检查都已经比较完整，保存后主要进入状态维护。',
        items: [],
        tone: 'success',
      };
}

function getPublishRuleSummary(publishRules?: unknown) {
  const rules = normalizeHousePublishRules(publishRules);
  const summary = summarizeHousePublishRules(rules);
  return {
    blocking: summary.blocking,
    warning: summary.warning,
    ignored: summary.ignored,
    blockingText: summary.blocking.length ? summary.blocking.join('、') : '无',
    warningText: summary.warning.length ? summary.warning.join('、') : '无',
    ignoredText: summary.ignored.length ? summary.ignored.join('、') : '无',
    landlordMode: rules.landlord.mode,
    rentMode: rules.rent.mode,
    mediaMode: rules.images.mode,
  };
}

const HouseNewPage: React.FC = () => {
  const { styles } = useStyles();
  const [form] = Form.useForm();
  const formValues = (Form.useWatch([], { form, preserve: true }) || {}) as HouseWizardFormValues;
  const selectedBuildingId = Form.useWatch('building_id', form);
  const queryParams = new URLSearchParams(window.location.search);
  const sourceBuildingId = Number(queryParams.get('building_id')) || undefined;
  const sourceLandlordId = Number(queryParams.get('landlord_id')) || undefined;
  const [currentStep, setCurrentStep] = useState(() => getInitialWizardStep(window.location.search));
  const [buildingOpen, setBuildingOpen] = useState(false);
  const [landlordOpen, setLandlordOpen] = useState(false);
  const [createdBuildings, setCreatedBuildings] = useState<{ id: number; name: string; estate_id: number; estate_name?: string }[]>([]);
  const [createdLandlords, setCreatedLandlords] = useState<ContactOut[]>([]);
  const workspace = useTenantWorkspace();
  const enabled = Boolean(workspace.selectedOrgSlug);
  const estates = useQuery({ queryKey: ['house', 'new', 'estates', workspace.selectedOrgSlug], queryFn: () => houseApi.listEstates({ page: 1, page_size: 100 }), enabled });
  const buildings = useQuery({ queryKey: ['house', 'new', 'buildings', workspace.selectedOrgSlug], queryFn: () => houseApi.listBuildings({ page: 1, page_size: 100 }), enabled });
  const defaultBuilding = useQuery({ queryKey: ['house', 'new', 'default-building', workspace.selectedOrgSlug], queryFn: () => houseApi.getDefaultBuilding(), enabled });
  const contacts = useQuery({ queryKey: ['house', 'new', 'contacts', workspace.selectedOrgSlug], queryFn: () => houseApi.listContacts({ page: 1, page_size: 100, role: 'landlord' }), enabled });
  const settings = useQuery({ queryKey: ['house', 'new', 'settings', workspace.selectedOrgSlug], queryFn: () => appsSettingsApiListOrgSettings(), enabled });
  const buildingItems = useMemo(() => [...createdBuildings, ...(buildings.data?.items || [])], [buildings.data, createdBuildings]);
  const landlordItems = useMemo(() => [...createdLandlords, ...(contacts.data?.items || [])], [contacts.data, createdLandlords]);
  const selectedBuilding = buildingItems.find((item) => item.id === (formValues.building_id as number | undefined));
  const selectedLandlord = landlordItems.find((item) => item.id === (formValues.landlord_id as number | undefined));
  const publishRules = useMemo(
    () => settings.data?.find((item) => item.key === publishRulesSettingKey)?.value,
    [settings.data],
  );
  const publishRuleSummary = useMemo(() => getPublishRuleSummary(publishRules), [publishRules]);
  const readiness = useMemo(() => getWizardReadiness(formValues, publishRules), [formValues, publishRules]);
  const publishIssues = readiness.publishIssues;
  const stepAlert = useMemo(() => getStepAlert(currentStep, readiness), [currentStep, readiness]);
  const gapChecklist = useMemo(() => getGapChecklist(readiness), [readiness]);
  const stepFocus = useMemo(() => getStepFocus(currentStep, readiness, gapChecklist), [currentStep, gapChecklist, readiness]);
  const mediaCompleteness = useMemo(() => getHouseMediaCompleteness(formValues), [formValues]);
  const canAdvanceFromDraftStep = readiness.draftReady;
  const sidebarGapChecklist = useMemo(() => {
    if (currentStep === 0) {
      return gapChecklist.filter((item) => item.category !== '草稿必补');
    }
    return currentStep === 3 ? gapChecklist : [];
  }, [currentStep, gapChecklist]);
  const showPublishRuleSummary = currentStep !== 1;
  const showGapChecklist = currentStep === 0 || currentStep === 3;
  const showMediaStatus = currentStep === 3;
  const lifecycleSignals: HouseLifecycleSignal[] = useMemo(() => [
    {
      key: 'draft',
      title: '草稿建档',
      status: readiness.draftReady ? '可保存' : '待补',
      summary: readiness.draftReady ? '最小建档已完成，可继续补资料或先保存。' : `当前还差：${readiness.draftMissing.join('、')}`,
    },
    {
      key: 'viewing',
      title: '带看基础',
      status: readiness.viewingReady ? '已齐备' : '待补',
      summary: readiness.viewingReady ? '租金、房东、可租日期都已具备。' : `当前还差：${readiness.viewingMissing.join('、')}`,
    },
    {
      key: 'publish',
      title: '发布准备',
      status: readiness.publishReady ? '可发布' : '有缺口',
      summary: readiness.publishReady
        ? readiness.publishWarningIssues.length
          ? `提醒项：${readiness.publishWarningIssues.join('、')}`
          : '基础资料和媒体已满足当前发布检查。'
        : `阻断项：${readiness.publishBlockingIssues.join('、')}`,
    },
    {
      key: 'handoff',
      title: '详情承接',
      status: !readiness.draftReady ? '待形成草稿' : readiness.publishReady ? '可直接承接' : '保存后继续补',
      summary: !readiness.draftReady
        ? '先把草稿建起来，再交给详情页继续维护。'
        : readiness.publishReady
          ? '保存后进入详情页，可继续发布、带看和签约承接。'
          : '保存后进入详情页，继续补齐发布和带看缺口。',
    },
  ], [readiness]);
  const createHouse = useMutation({
    mutationFn: (values: Record<string, unknown>) => houseApi.createHouse(values),
    onSuccess: (house) => {
      message.success('房源已创建');
      history.push(`/property-rental/houses/${house.id}`);
    },
  });
  const createBuilding = useMutation({
    mutationFn: (values: Record<string, unknown>) => houseApi.createBuilding(values),
    onSuccess: (building) => {
      setCreatedBuildings((items) => [building, ...items]);
      form.setFieldValue('building_id', building.id);
      houseApi.setDefaultBuilding(building.id);
      setBuildingOpen(false);
    },
  });
  const createLandlord = useMutation({
    mutationFn: (values: Record<string, unknown>) => houseApi.createContact({ ...values, roles: [CONTACT_ROLE.LANDLORD], is_active: true }),
    onSuccess: (contact) => {
      setCreatedLandlords((items) => [contact, ...items]);
      form.setFieldValue('landlord_id', contact.id);
      setLandlordOpen(false);
    },
  });
  const setDefaultBuilding = useMutation({
    mutationFn: (buildingId: number) => houseApi.setDefaultBuilding(buildingId),
    onSuccess: () => message.success('默认楼栋已更新'),
  });

  useEffect(() => {
    const sourceBuilding = buildingItems.find((item) => item.id === sourceBuildingId);
    const firstBuilding = sourceBuilding || buildingItems.find((item) => item.id === defaultBuilding.data?.id) || buildingItems[0];
    form.setFieldsValue({
      building_id: form.getFieldValue('building_id') || firstBuilding?.id,
      landlord_id: form.getFieldValue('landlord_id') || sourceLandlordId,
    });
  }, [buildingItems, defaultBuilding.data, form, sourceBuildingId, sourceLandlordId]);

  useEffect(() => {
    syncWizardStepSearch(currentStep);
  }, [currentStep]);

  const submit = (values: Record<string, unknown>) => {
    const allValues = { ...form.getFieldsValue(true), ...values };
    const buildingId = allValues.building_id || buildingItems[0]?.id;
    if (!buildingId) {
      setBuildingOpen(true);
      return;
    }
    const { landlord_id, ...restValues } = allValues;
    const payload = {
      ...restValues,
      building_id: buildingId,
      ...(landlord_id ? { landlord_id } : {}),
    };
    createHouse.mutate(payload);
  };

  const saveDraftNow = async () => {
    try {
      await form.validateFields(STEP_FIELDS[0]);
    } catch {
      return;
    }
    submit(form.getFieldsValue(true));
  };

  const goNext = async () => {
    const fields = STEP_FIELDS[currentStep] || [];
    if (fields.length) {
      try {
        await form.validateFields(fields);
      } catch {
        return;
      }
    }
    setCurrentStep((step) => Math.min(step + 1, STEP_ITEMS.length - 1));
  };

  const goPrev = () => {
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  const renderStepContent = () => {
    if (currentStep === 0) {
      return (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Typography.Title level={5} style={{ marginBottom: 4 }}>选择楼栋与房东</Typography.Title>
            <Typography.Text type="secondary">草稿最低要求是楼栋和房号，房东可以稍后补齐。</Typography.Text>
          </div>
          {sourceBuildingId ? <Alert type="info" showIcon title="已带入楼栋，当前建档会直接挂到这栋楼下。" /> : null}
          {sourceLandlordId ? <Alert type="info" showIcon title="已带入房东，当前录入会沿用该出租方主体。" /> : null}
          <Alert type="info" showIcon title="默认楼栋来自空间设置；常用录入可直接沿用，不合适时再现场新建。" />
          <Form.Item label="楼栋" required>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="building_id" noStyle rules={[{ required: true, message: '请选择楼栋' }]}>
                <Select loading={buildings.isLoading} options={buildingItems.map((item) => ({ value: item.id, label: buildingLabel(item) }))} />
              </Form.Item>
              <Button onClick={() => setDefaultBuilding.mutate(selectedBuildingId)} disabled={!selectedBuildingId} loading={setDefaultBuilding.isPending}>
                设为默认
              </Button>
              <Button onClick={() => setBuildingOpen(true)}>新建楼栋</Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item label="房东" htmlFor="landlord_id">
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="landlord_id" noStyle>
                <Select allowClear loading={contacts.isLoading} options={landlordItems.map((item) => ({ value: item.id, label: contactLabel(item) }))} />
              </Form.Item>
              <Button onClick={() => setLandlordOpen(true)}>新建房东</Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item label="房号" name="room_number" rules={[{ required: true, message: '请输入房号' }]}>
            <Input />
          </Form.Item>
        </Space>
      );
    }

    if (currentStep === 1) {
      return (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Typography.Title level={5} style={{ marginBottom: 4 }}>补充挂牌与户型</Typography.Title>
            <Typography.Text type="secondary">这一页优先补齐带看、报价和签约最常追问的字段。</Typography.Text>
          </div>
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <Typography.Text strong>挂牌信息</Typography.Text>
            </div>
            <Row gutter={[16, 0]}>
              <Col xs={24} md={8}>
                <Form.Item label="挂牌租金" name="asking_rent">
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="押金" name="deposit_amount">
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="可租日期" name="available_from">
                  <Input type="date" />
                </Form.Item>
              </Col>
            </Row>
          </div>
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <Typography.Text strong>户型与面积</Typography.Text>
            </div>
            <Row gutter={[16, 0]}>
              <Col xs={24} md={8}>
                <Form.Item label="所在楼层" name="floor">
                  <Input type="number" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="建筑面积" name="area">
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="套内面积" name="interior_area">
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label="室" name="bedrooms">
                  <Input type="number" min={0} />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label="厅" name="living_rooms">
                  <Input type="number" min={0} />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label="卫" name="bathrooms">
                  <Input type="number" min={0} />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label="厨" name="kitchens">
                  <Input type="number" min={0} />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label="阳台" name="balconies">
                  <Input type="number" min={0} />
                </Form.Item>
              </Col>
            </Row>
          </div>
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <Typography.Text strong>房源卖点</Typography.Text>
            </div>
            <Row gutter={[16, 0]}>
              <Col xs={24} md={12}>
                <Form.Item label="朝向" name="orientation">
                  <Select allowClear options={HOUSE_ORIENTATION_OPTIONS} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="装修" name="decoration">
                  <Select allowClear options={HOUSE_DECORATION_OPTIONS} />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item label="对外描述" name="public_description">
                  <Input.TextArea rows={4} />
                </Form.Item>
              </Col>
            </Row>
          </div>
        </Space>
      );
    }

    if (currentStep === 2) {
      return (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Typography.Title level={5} style={{ marginBottom: 4 }}>上传图片与视频</Typography.Title>
            <Typography.Text type="secondary">先看阻断项，再决定哪些媒体素材现在补、哪些留到详情页继续补。</Typography.Text>
          </div>
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <Typography.Text strong>图片资料</Typography.Text>
            </div>
            <Descriptions size="small" column={3}>
              <Descriptions.Item label="当前图片">{mediaCompleteness.imageCount} 张</Descriptions.Item>
              <Descriptions.Item label="封面">{mediaCompleteness.hasCover ? '已配置' : '待补'}</Descriptions.Item>
              <Descriptions.Item label="户型图">{mediaCompleteness.hasFloorPlan ? '已配置' : '待补'}</Descriptions.Item>
            </Descriptions>
            <Form.Item label="图片" name="images" style={{ marginTop: 16, marginBottom: 0 }}>
              <MediaRefsUpload resourceType={HOUSE_MEDIA_RESOURCE_TYPE.HOUSE_IMAGE} mediaType={HOUSE_MEDIA_TYPE.IMAGE} />
            </Form.Item>
          </div>
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <Typography.Text strong>视频资料</Typography.Text>
              <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                当前规则下视频不是硬门槛，但补上后更利于线上展示和带看转化。
              </Typography.Paragraph>
            </div>
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="当前视频">{mediaCompleteness.videoCount} 个</Descriptions.Item>
            </Descriptions>
            <Form.Item label="视频" name="videos" style={{ marginTop: 16, marginBottom: 0 }}>
              <MediaRefsUpload resourceType={HOUSE_MEDIA_RESOURCE_TYPE.HOUSE_VIDEO} mediaType={HOUSE_MEDIA_TYPE.VIDEO} />
            </Form.Item>
          </div>
        </Space>
      );
    }

    return (
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={5} style={{ marginBottom: 4 }}>确认房源草稿</Typography.Title>
          <Typography.Text type="secondary">保存后进入房源详情页，继续处理发布、带看和租约。</Typography.Text>
        </div>
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="当前业务状态">
            <Space wrap>
              <Tag color={readiness.draftReady ? 'green' : 'orange'}>{readiness.draftReady ? '草稿可保存' : '草稿待补'}</Tag>
              <Tag color={readiness.viewingReady ? 'blue' : 'orange'}>{readiness.viewingReady ? '可安排带看' : '带看资料待补'}</Tag>
              <Tag color={readiness.publishReady ? 'green' : 'orange'}>{readiness.publishReady ? '可进入发布流程' : '发布资料待补'}</Tag>
            </Space>
          </Descriptions.Item>
        </Descriptions>
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="楼栋">{selectedBuilding ? buildingLabel(selectedBuilding) : '待选择'}</Descriptions.Item>
          <Descriptions.Item label="房东">{selectedLandlord ? contactLabel(selectedLandlord) : '待补房东'}</Descriptions.Item>
          <Descriptions.Item label="房号">{(formValues.room_number as string) || '待填写'}</Descriptions.Item>
          <Descriptions.Item label="挂牌租金">{moneyText(formValues.asking_rent as string | number | null | undefined)}</Descriptions.Item>
          <Descriptions.Item label="可租日期">{(formValues.available_from as string) || '-'}</Descriptions.Item>
          <Descriptions.Item label="户型">{houseLayoutText(formValues as Record<string, unknown>)}</Descriptions.Item>
          <Descriptions.Item label="图片">{`${((formValues.images as MediaRefValue[] | undefined) || []).length} 张`}</Descriptions.Item>
          <Descriptions.Item label="视频">{`${((formValues.videos as MediaRefValue[] | undefined) || []).length} 个`}</Descriptions.Item>
        </Descriptions>
        <Alert
          type={!readiness.publishReady ? 'warning' : readiness.publishWarningIssues.length ? 'info' : 'success'}
          showIcon
          title={!readiness.publishReady ? '保存后仍有阻断项' : readiness.publishWarningIssues.length ? '保存后仍有提醒项' : '保存后可直接进入发布流程'}
          description={
            !readiness.publishReady || readiness.publishWarningIssues.length ? (
              <Space wrap size={[8, 8]}>
                {[...new Set([...readiness.viewingMissing, ...publishIssues])].map((item) => (
                  <Tag color={readiness.publishBlockingIssues.includes(item) ? 'orange' : readiness.publishWarningIssues.includes(item) ? 'blue' : 'gold'} key={item}>
                    {item}
                  </Tag>
                ))}
              </Space>
            ) : '资料、房东和媒体已经满足当前发布检查。'
          }
        />
        <div className={styles.sectionBlock}>
          <Typography.Text strong>保存后建议动作</Typography.Text>
          <div style={{ marginTop: 12 }}>
            <Typography.Paragraph style={{ marginBottom: 8 }}>
              1. 进入房源详情页核对房态、发布状态和媒体完整度。
            </Typography.Paragraph>
            <Typography.Paragraph style={{ marginBottom: 8 }}>
              2. {readiness.publishReady ? '可以直接执行发布，随后交给运营安排带看。' : '优先补齐发布缺口，再决定是否上线承接带看。'}
            </Typography.Paragraph>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              3. {readiness.viewingReady ? '如果已有意向租客，可从详情页直接登记带看或推进签约。' : '当前还不适合直接交给带看同事，建议先把关键资料补齐。'}
            </Typography.Paragraph>
          </div>
        </div>
      </Space>
    );
  };

  return (
    <TenantSelectionGuard title="新建房源" subtitle="先完成可保存的建档，再进入详情页继续补媒体和发布。">
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <div className={styles.sectionBlock}>
          <Typography.Text strong>闭环信号</Typography.Text>
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            {lifecycleSignals.map((item) => (
              <Col key={item.key} xs={24} md={12} xl={6}>
                <div className={styles.metricPanel}>
                  <Typography.Text type="secondary">{item.title}</Typography.Text>
                  <div className={styles.metricValue}>{item.status}</div>
                  <Typography.Text type="secondary">{item.summary}</Typography.Text>
                </div>
              </Col>
            ))}
          </Row>
        </div>
        <Card title="房源建档向导">
          <Form form={form} layout="vertical" onFinish={submit}>
            <Steps current={currentStep} items={STEP_ITEMS} style={{ marginBottom: 24 }} />
            <Alert type={stepAlert.type} showIcon title={stepAlert.title} description={stepAlert.description} style={{ marginBottom: 16 }} />
            <Row gutter={[24, 24]} align="top">
              <Col xs={24} xl={16}>
                <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                  <div>
                    <Typography.Text strong>{STEP_ITEMS[currentStep]?.title}</Typography.Text>
                    <br />
                    <Typography.Text type="secondary">{STEP_INTRO[currentStep]}</Typography.Text>
                  </div>
                  {renderStepContent()}
                </Space>
              </Col>
              <Col xs={24} xl={8}>
                <div className={styles.sidebar}>
                  <div className={styles.sidebarBlock}>
                    <Typography.Text strong>当前步骤重点</Typography.Text>
                    <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 12 }}>
                      {stepFocus.description}
                    </Typography.Paragraph>
                    <Alert
                      type={stepFocus.tone === 'default' ? 'info' : stepFocus.tone}
                      showIcon
                      message={stepFocus.title}
                      description={stepFocus.items.length ? (
                        <Space wrap size={[8, 8]} style={{ marginTop: 8 }}>
                          {stepFocus.items.map((item) => (
                            <Tag key={item}>{item}</Tag>
                          ))}
                        </Space>
                      ) : undefined}
                    />
                  </div>
                  {showPublishRuleSummary ? (
                    <div className={styles.sidebarBlock}>
                      <Typography.Text strong>发布规则摘要</Typography.Text>
                      <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 12 }}>
                        当前空间规则决定哪些字段会阻断发布，哪些只是提醒。
                      </Typography.Paragraph>
                      <Descriptions column={1} size="small">
                        <Descriptions.Item label="阻断发布">{publishRuleSummary.blockingText}</Descriptions.Item>
                        <Descriptions.Item label="提醒发布">{publishRuleSummary.warningText}</Descriptions.Item>
                        <Descriptions.Item label="忽略字段">{publishRuleSummary.ignoredText}</Descriptions.Item>
                        <Descriptions.Item label="当前结论">
                          {readiness.publishReady ? '当前可以发布' : '当前不能发布'}
                        </Descriptions.Item>
                      </Descriptions>
                      <div style={{ marginTop: 12 }}>
                        <Space wrap size={[8, 8]}>
                          <Tag color={publishRuleSummary.landlordMode === 'required' ? 'red' : publishRuleSummary.landlordMode === 'warn' ? 'gold' : 'default'}>
                            房东：{HOUSE_PUBLISH_RULE_LABELS.landlord}
                          </Tag>
                          <Tag color={publishRuleSummary.rentMode === 'required' ? 'red' : publishRuleSummary.rentMode === 'warn' ? 'gold' : 'default'}>
                            租金：{HOUSE_PUBLISH_RULE_LABELS.rent}
                          </Tag>
                          <Tag color={publishRuleSummary.mediaMode === 'required' ? 'red' : publishRuleSummary.mediaMode === 'warn' ? 'gold' : 'default'}>
                            媒体：{HOUSE_PUBLISH_RULE_LABELS.images}
                          </Tag>
                        </Space>
                      </div>
                    </div>
                  ) : null}
                  {showGapChecklist ? (
                    <div className={styles.sidebarBlock}>
                      <Typography.Text strong>当前缺口清单</Typography.Text>
                      <div style={{ marginTop: 12 }}>
                        {sidebarGapChecklist.length ? (
                          <Space wrap size={[8, 8]}>
                            {sidebarGapChecklist.map((item) => (
                              <Tag
                                key={item.key}
                                color={
                                  item.category === '阻断发布'
                                    ? 'orange'
                                    : item.category === '发布提醒'
                                      ? 'blue'
                                      : item.category === '带看前补'
                                        ? 'gold'
                                        : 'default'
                                }
                              >
                                {`${item.category}：${item.label}`}
                              </Tag>
                            ))}
                          </Space>
                        ) : (
                          <Typography.Text type="secondary">当前没有阻塞项，保存后可直接流转到后续动作。</Typography.Text>
                        )}
                      </div>
                    </div>
                  ) : null}
                  {showMediaStatus ? (
                    <div className={styles.sidebarBlock}>
                      <Typography.Text strong>媒体状态</Typography.Text>
                      <Descriptions column={1} size="small" style={{ marginTop: 12 }}>
                        <Descriptions.Item label="图片">{mediaCompleteness.imageCount} 张</Descriptions.Item>
                        <Descriptions.Item label="视频">{mediaCompleteness.videoCount} 个</Descriptions.Item>
                        <Descriptions.Item label="封面">{mediaCompleteness.hasCover ? '已配置' : '待补'}</Descriptions.Item>
                        <Descriptions.Item label="户型图">{mediaCompleteness.hasFloorPlan ? '已配置' : '待补'}</Descriptions.Item>
                      </Descriptions>
                    </div>
                  ) : null}
                  <div>
                    <Typography.Text strong>保存后动作</Typography.Text>
                    <div style={{ marginTop: 12 }}>
                      <Typography.Text type="secondary">
                        {readiness.publishReady
                          ? readiness.publishWarningIssues.length
                            ? '保存后可直接发布，但建议继续补齐提醒项，避免线上展示质量偏弱。'
                            : '保存后可直接去详情页发布，并把房源交给运营承接带看。'
                          : readiness.viewingReady
                            ? '保存后建议先补媒体，再进入发布流程。'
                            : '当前更适合先保存草稿，再继续补带看和发布所需资料。'}
                      </Typography.Text>
                    </div>
                  </div>
                </div>
              </Col>
            </Row>
            <Space className={styles.footerActions}>
              {currentStep > 0 ? (
                <Button onClick={goPrev}>上一步</Button>
              ) : null}
              <Button onClick={() => void saveDraftNow()} disabled={!readiness.draftReady || createHouse.isPending} loading={createHouse.isPending}>
                保存草稿
              </Button>
              {currentStep < STEP_ITEMS.length - 1 ? (
                <Button type="primary" onClick={() => void goNext()} disabled={currentStep === 0 && !canAdvanceFromDraftStep}>
                  下一步
                </Button>
              ) : (
                <Button type="primary" htmlType="submit" loading={createHouse.isPending} disabled={buildings.isLoading}>
                  保存并进入详情
                </Button>
              )}
            </Space>
          </Form>
        </Card>
      </Space>
      <Modal
        title="新建楼栋"
        open={buildingOpen}
        onCancel={() => setBuildingOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form
          layout="vertical"
          initialValues={{ estate_id: estates.data?.items?.[0]?.id, floors: 1 }}
          onFinish={(values) => createBuilding.mutate({ ...values, estate_id: values.estate_id || estates.data?.items?.[0]?.id, floors: Number(values.floors) })}
        >
          <Form.Item label="项目小区" name="estate_id">
            <Select loading={estates.isLoading} options={(estates.data?.items || []).map((item) => ({ value: item.id, label: item.display_name || item.name }))} />
          </Form.Item>
          <Form.Item label="楼栋名" name="name" rules={[{ required: true, message: '请输入楼栋名' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="楼层" name="floors" rules={[{ required: true, message: '请输入楼层' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="地址" name="address">
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={createBuilding.isPending}>
            保存楼栋
          </Button>
        </Form>
      </Modal>
      <Modal
        title="新建房东"
        open={landlordOpen}
        onCancel={() => setLandlordOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form layout="vertical" onFinish={(values) => createLandlord.mutate(values)}>
          <Form.Item label="姓名" name="name" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="手机" name="phone" rules={[{ required: true, message: '请输入手机号' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="邮箱" name="email">
            <Input />
          </Form.Item>
          <Form.Item label="备注" name="notes">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={createLandlord.isPending}>
            保存房东
          </Button>
        </Form>
      </Modal>
    </TenantSelectionGuard>
  );
};

export default HouseNewPage;
