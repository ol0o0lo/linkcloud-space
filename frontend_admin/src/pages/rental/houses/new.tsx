import { useMutation, useQuery } from '@tanstack/react-query';
import { history } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
  Row,
  Select,
  Space,
  Steps,
  Tag,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useMemo, useState } from 'react';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/space/shared';
import { enumSelectOptions, useEnums } from '@/services/manual/enums';
import {
  type BuildingOut,
  type ContactOut,
  houseApi,
} from '@/services/manual/house';
import MediaRefsUpload from '../components/MediaRefsUpload';
import { PropertyTagSelect } from '../components/PropertyTagSelect';
import {
  buildingLabel,
  CONTACT_ROLE,
  contactLabel,
  evaluateHousePublishState,
  getHouseMediaCompleteness,
  HOUSE_MEDIA_RESOURCE_TYPE,
  HOUSE_MEDIA_TYPE,
  houseBalconyText,
  houseKitchenText,
  houseLayoutText,
  type MediaRefValue,
  moneyText,
} from '../constants';
import { useHousePublishRules } from '../useHousePublishRules';
import { usePagedSelectOptions } from '../usePagedSelectOptions';

const STEP_ITEMS = [
  { title: '建档' },
  { title: '补充资料' },
  { title: '媒体资料' },
  { title: '确认保存' },
];

const STEP_FIELDS: string[][] = [['building_id', 'room_number'], [], [], []];

const HOUSE_NUMERIC_FIELDS = [
  'floor',
  'area',
  'interior_area',
  'asking_rent',
  'deposit_amount',
  'bedrooms',
  'living_rooms',
  'bathrooms',
  'kitchens',
  'balconies',
] as const;

type HouseWizardFormValues = Record<string, unknown> & {
  asking_rent?: string | number | null;
  building_id?: number | null;
  images?: MediaRefValue[];
  landlord_id?: number | null;
  room_number?: string;
  videos?: MediaRefValue[];
};

const useStyles = createStyles(({ token, css }) => ({
  sectionBlock: css`
    padding: 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
  `,
  sectionHeader: css`
    margin-bottom: 16px;
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

function getMissingFields(
  values: HouseWizardFormValues,
  fields: Array<{ key: keyof HouseWizardFormValues; label: string }>,
) {
  return fields
    .filter((item) => !hasValue(values[item.key]))
    .map((item) => item.label);
}

function getWizardReadiness(
  values: HouseWizardFormValues,
  publishRules?: unknown,
) {
  const publishState = evaluateHousePublishState(values, publishRules);
  const baseMissing = getMissingFields(values, [
    { key: 'building_id', label: '楼栋' },
    { key: 'room_number', label: '房号' },
  ]);
  const viewingMissing = getMissingFields(values, [
    { key: 'landlord_id', label: '房东' },
    { key: 'asking_rent', label: '挂牌租金' },
  ]);
  return {
    baseMissing,
    baseReady: !baseMissing.length,
    publishBlockingIssues: publishState.blockingIssues,
    publishWarningIssues: publishState.warningIssues,
    publishReady: publishState.canPublish,
    viewingMissing,
    viewingReady: !viewingMissing.length,
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

function normalizeHouseNumericValues(values: Record<string, unknown>) {
  const normalized = { ...values };
  HOUSE_NUMERIC_FIELDS.forEach((field) => {
    if (
      field in normalized &&
      (normalized[field] === '' ||
        normalized[field] === null ||
        normalized[field] === undefined)
    ) {
      normalized[field] = 0;
    }
  });
  return normalized;
}

const HouseNewPage: React.FC = () => {
  const { styles } = useStyles();
  const [form] = Form.useForm();
  const formValues = (Form.useWatch([], { form, preserve: true }) ||
    {}) as HouseWizardFormValues;
  const selectedBuildingId = Form.useWatch('building_id', form);
  const queryParams = new URLSearchParams(window.location.search);
  const sourceBuildingId = Number(queryParams.get('building_id')) || undefined;
  const sourceLandlordId = Number(queryParams.get('landlord_id')) || undefined;
  const [currentStep, setCurrentStep] = useState(() =>
    getInitialWizardStep(window.location.search),
  );
  const [buildingOpen, setBuildingOpen] = useState(false);
  const [landlordOpen, setLandlordOpen] = useState(false);
  const [createdBuildings, setCreatedBuildings] = useState<BuildingOut[]>([]);
  const [createdLandlords, setCreatedLandlords] = useState<ContactOut[]>([]);
  const workspace = useTenantWorkspace();
  const publishRules = useHousePublishRules();
  const enabled = Boolean(workspace.selectedOrgSlug);
  const houseEnums = useEnums([
    'house.house_orientation',
    'house.house_decoration',
  ]);
  const defaultBuilding = useQuery({
    queryKey: ['house', 'new', 'default-building', workspace.selectedOrgSlug],
    queryFn: () => houseApi.getDefaultBuilding(),
    enabled,
  });
  const estates = usePagedSelectOptions({
    queryKey: ['house', 'new', 'estates', workspace.selectedOrgSlug],
    queryFn: (params) => houseApi.listEstates(params),
    enabled: enabled && buildingOpen,
  });
  const pinnedBuildings = useMemo(
    () => [
      ...createdBuildings,
      defaultBuilding.data as BuildingOut | undefined,
    ],
    [createdBuildings, defaultBuilding.data],
  );
  const buildings = usePagedSelectOptions<BuildingOut>({
    queryKey: ['house', 'new', 'buildings', workspace.selectedOrgSlug],
    queryFn: (params) => houseApi.listBuildings(params),
    pinnedItems: pinnedBuildings,
    enabled,
  });
  const contacts = usePagedSelectOptions<ContactOut>({
    queryKey: ['house', 'new', 'contacts', workspace.selectedOrgSlug],
    queryFn: (params) =>
      houseApi.listContacts({
        ...params,
        role: 'landlord',
        task: 'active',
      }),
    pinnedItems: createdLandlords,
    enabled,
  });
  const tagSuggestions = useQuery({
    queryKey: ['house', 'tag-suggestions'],
    queryFn: () => houseApi.getTagSuggestions(),
    enabled,
  });
  const buildingItems = buildings.items;
  const landlordItems = contacts.items;
  const orientationOptions = enumSelectOptions(
    houseEnums.data,
    'house.house_orientation',
  );
  const decorationOptions = enumSelectOptions(
    houseEnums.data,
    'house.house_decoration',
  );
  const selectedBuilding = buildingItems.find(
    (item) => item.id === (formValues.building_id as number | undefined),
  );
  const selectedLandlord = landlordItems.find(
    (item) => item.id === (formValues.landlord_id as number | undefined),
  );
  const readiness = useMemo(
    () => getWizardReadiness(formValues, publishRules.rules),
    [formValues, publishRules.rules],
  );
  const mediaCompleteness = useMemo(
    () => getHouseMediaCompleteness(formValues),
    [formValues],
  );
  const canAdvanceFromBaseStep = readiness.baseReady;
  const createHouse = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      houseApi.createHouse(values),
    onSuccess: (house) => {
      message.success('房源已创建');
      history.push(`/rental/properties/${house.id}`);
    },
  });
  const createBuilding = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      houseApi.createBuilding(values),
    onSuccess: (building) => {
      setCreatedBuildings((items) => [building, ...items]);
      form.setFieldValue('building_id', building.id);
      houseApi.setDefaultBuilding(building.id);
      setBuildingOpen(false);
    },
  });
  const createLandlord = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      houseApi.createContact({
        ...values,
        roles: [CONTACT_ROLE.LANDLORD],
        is_active: true,
      }),
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
    const sourceBuilding = buildingItems.find(
      (item) => item.id === sourceBuildingId,
    );
    const firstBuilding =
      sourceBuilding ||
      buildingItems.find((item) => item.id === defaultBuilding.data?.id) ||
      buildingItems[0];
    form.setFieldsValue({
      building_id: form.getFieldValue('building_id') || firstBuilding?.id,
      landlord_id: form.getFieldValue('landlord_id') || sourceLandlordId,
    });
  }, [
    buildingItems,
    defaultBuilding.data,
    form,
    sourceBuildingId,
    sourceLandlordId,
  ]);

  useEffect(() => {
    syncWizardStepSearch(currentStep);
  }, [currentStep]);

  const submit = (values: Record<string, unknown>) => {
    const allValues = normalizeHouseNumericValues({
      ...form.getFieldsValue(true),
      ...values,
    });
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

  const saveHouseNow = async () => {
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
            <Typography.Title level={5} style={{ marginBottom: 4 }}>
              选择楼栋与房东
            </Typography.Title>
          </div>
          {sourceBuildingId ? (
            <Alert
              type="info"
              showIcon
              title="已带入楼栋，当前建档会直接挂到这栋楼下。"
            />
          ) : null}
          {sourceLandlordId ? (
            <Alert
              type="info"
              showIcon
              title="已带入房东，当前录入会沿用该出租方主体。"
            />
          ) : null}
          <Form.Item label="楼栋" htmlFor="building_id" required>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item
                name="building_id"
                noStyle
                rules={[{ required: true, message: '请选择楼栋' }]}
              >
                <Select
                  showSearch={buildings.showSearch}
                  loading={buildings.loading}
                  notFoundContent={buildings.notFoundContent}
                  onOpenChange={buildings.onOpenChange}
                  onPopupScroll={buildings.onPopupScroll}
                  placeholder="搜索项目、小区或楼栋"
                  options={buildingItems.map((item) => ({
                    value: item.id,
                    label: buildingLabel(item),
                  }))}
                />
              </Form.Item>
              <Button
                onClick={() => setDefaultBuilding.mutate(selectedBuildingId)}
                disabled={!selectedBuildingId}
                loading={setDefaultBuilding.isPending}
              >
                设为默认
              </Button>
              <Button onClick={() => setBuildingOpen(true)}>新建楼栋</Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item label="房东" htmlFor="landlord_id">
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="landlord_id" noStyle>
                <Select
                  allowClear
                  showSearch={contacts.showSearch}
                  loading={contacts.loading}
                  notFoundContent={contacts.notFoundContent}
                  onOpenChange={contacts.onOpenChange}
                  onPopupScroll={contacts.onPopupScroll}
                  placeholder="搜索房东姓名、手机或邮箱"
                  options={landlordItems.map((item) => ({
                    value: item.id,
                    label: contactLabel(item),
                  }))}
                />
              </Form.Item>
              <Button onClick={() => setLandlordOpen(true)}>新建房东</Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item
            label="房号"
            name="room_number"
            rules={[{ required: true, message: '请输入房号' }]}
          >
            <Input />
          </Form.Item>
        </Space>
      );
    }

    if (currentStep === 1) {
      return (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Typography.Title level={5} style={{ marginBottom: 4 }}>
              补充挂牌与户型
            </Typography.Title>
          </div>
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <Typography.Text strong>挂牌信息</Typography.Text>
            </div>
            <Row gutter={[16, 0]}>
              <Col xs={24} md={8}>
                <Form.Item label="挂牌租金" name="asking_rent">
                  <InputNumber
                    min={0}
                    precision={2}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="押金" name="deposit_amount">
                  <InputNumber
                    min={0}
                    precision={2}
                    style={{ width: '100%' }}
                  />
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
                  <InputNumber precision={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="建筑面积" name="area">
                  <InputNumber
                    min={0}
                    precision={2}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="套内面积" name="interior_area">
                  <InputNumber
                    min={0}
                    precision={2}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label="卧室" name="bedrooms">
                  <InputNumber
                    min={0}
                    precision={0}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label="客厅" name="living_rooms">
                  <InputNumber
                    min={0}
                    precision={0}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label="卫生间" name="bathrooms">
                  <InputNumber
                    min={0}
                    precision={0}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label="厨房" name="kitchens">
                  <InputNumber
                    min={0}
                    precision={0}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label="阳台" name="balconies">
                  <InputNumber
                    min={0}
                    precision={0}
                    style={{ width: '100%' }}
                  />
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
                  <Select
                    allowClear
                    showSearch={{ optionFilterProp: 'label' }}
                    options={orientationOptions}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="装修" name="decoration">
                  <Select
                    allowClear
                    showSearch={{ optionFilterProp: 'label' }}
                    options={decorationOptions}
                  />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item label="房源标签" name="tags">
                  <PropertyTagSelect
                    inheritedTags={selectedBuilding?.tags}
                    suggestions={tagSuggestions.data?.tags ?? []}
                    suggestionsLoading={tagSuggestions.isLoading}
                    suggestionsError={tagSuggestions.isError}
                  />
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
            <Typography.Title level={5} style={{ marginBottom: 4 }}>
              上传图片与视频
            </Typography.Title>
          </div>
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <Typography.Text strong>图片资料</Typography.Text>
            </div>
            <Descriptions size="small" column={3}>
              <Descriptions.Item label="当前图片">
                {mediaCompleteness.imageCount} 张
              </Descriptions.Item>
              <Descriptions.Item label="封面">
                {mediaCompleteness.hasCover ? '已配置' : '待补'}
              </Descriptions.Item>
              <Descriptions.Item label="户型图">
                {mediaCompleteness.hasFloorPlan ? '已配置' : '待补'}
              </Descriptions.Item>
            </Descriptions>
            <Form.Item
              label="图片"
              name="images"
              style={{ marginTop: 16, marginBottom: 0 }}
            >
              <MediaRefsUpload
                resourceType={HOUSE_MEDIA_RESOURCE_TYPE.HOUSE_IMAGE}
                mediaType={HOUSE_MEDIA_TYPE.IMAGE}
              />
            </Form.Item>
          </div>
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <Typography.Text strong>视频资料</Typography.Text>
            </div>
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="当前视频">
                {mediaCompleteness.videoCount} 个
              </Descriptions.Item>
            </Descriptions>
            <Form.Item
              label="视频"
              name="videos"
              style={{ marginTop: 16, marginBottom: 0 }}
            >
              <MediaRefsUpload
                resourceType={HOUSE_MEDIA_RESOURCE_TYPE.HOUSE_VIDEO}
                mediaType={HOUSE_MEDIA_TYPE.VIDEO}
              />
            </Form.Item>
          </div>
        </Space>
      );
    }

    return (
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={5} style={{ marginBottom: 4 }}>
            确认房源资料
          </Typography.Title>
        </div>
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="当前业务状态">
            <Space wrap>
              <Tag color={readiness.baseReady ? 'green' : 'orange'}>
                {readiness.baseReady ? '可以保存' : '基础资料待补'}
              </Tag>
              <Tag color={readiness.viewingReady ? 'blue' : 'orange'}>
                {readiness.viewingReady ? '可安排带看' : '带看资料待补'}
              </Tag>
              <Tag color={readiness.publishReady ? 'green' : 'orange'}>
                {readiness.publishReady ? '可进入发布流程' : '发布资料待补'}
              </Tag>
            </Space>
          </Descriptions.Item>
        </Descriptions>
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="楼栋">
            {selectedBuilding ? buildingLabel(selectedBuilding) : '待选择'}
          </Descriptions.Item>
          <Descriptions.Item label="房东">
            {selectedLandlord ? contactLabel(selectedLandlord) : '待补房东'}
          </Descriptions.Item>
          <Descriptions.Item label="房号">
            {(formValues.room_number as string) || '待填写'}
          </Descriptions.Item>
          <Descriptions.Item label="挂牌租金">
            {moneyText(
              formValues.asking_rent as string | number | null | undefined,
            )}
          </Descriptions.Item>
          <Descriptions.Item label="户型">
            {houseLayoutText(formValues as Record<string, unknown>)}
          </Descriptions.Item>
          <Descriptions.Item label="厨房">
            {houseKitchenText(formValues as Record<string, unknown>)}
          </Descriptions.Item>
          <Descriptions.Item label="阳台">
            {houseBalconyText(formValues as Record<string, unknown>)}
          </Descriptions.Item>
          <Descriptions.Item label="图片">{`${((formValues.images as MediaRefValue[] | undefined) || []).length} 张`}</Descriptions.Item>
          <Descriptions.Item label="视频">{`${((formValues.videos as MediaRefValue[] | undefined) || []).length} 个`}</Descriptions.Item>
        </Descriptions>
      </Space>
    );
  };

  return (
    <TenantSelectionGuard title="新建房源">
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Card title="房源建档向导">
          <Form form={form} layout="vertical" onFinish={submit}>
            <Steps
              current={currentStep}
              items={STEP_ITEMS}
              style={{ marginBottom: 24 }}
            />
            <Row gutter={[24, 24]} align="top">
              <Col xs={24} xl={16}>
                <Space
                  orientation="vertical"
                  size={16}
                  style={{ width: '100%' }}
                >
                  {renderStepContent()}
                </Space>
              </Col>
            </Row>
            <Space className={styles.footerActions}>
              {currentStep > 0 ? (
                <Button onClick={goPrev}>上一步</Button>
              ) : null}
              <Button
                onClick={() => void saveHouseNow()}
                disabled={!readiness.baseReady || createHouse.isPending}
                loading={createHouse.isPending}
              >
                保存房源
              </Button>
              {currentStep < STEP_ITEMS.length - 1 ? (
                <Button
                  type="primary"
                  onClick={() => void goNext()}
                  disabled={currentStep === 0 && !canAdvanceFromBaseStep}
                >
                  下一步
                </Button>
              ) : (
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={createHouse.isPending}
                  disabled={buildings.loading}
                >
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
          initialValues={{ floors: 1 }}
          onFinish={(values) =>
            createBuilding.mutate({
              ...values,
              estate_id: values.estate_id ?? null,
              floors: Number(values.floors),
            })
          }
        >
          <Form.Item label="项目小区" name="estate_id">
            <Select
              allowClear
              showSearch={estates.showSearch}
              loading={estates.loading}
              notFoundContent={estates.notFoundContent}
              onOpenChange={estates.onOpenChange}
              onPopupScroll={estates.onPopupScroll}
              placeholder="搜索项目或小区"
              options={estates.items.map((item) => ({
                value: item.id,
                label: item.display_name || item.name,
              }))}
            />
          </Form.Item>
          <Form.Item
            label="楼栋名"
            name="name"
            rules={[{ required: true, message: '请输入楼栋名' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="楼层"
            name="floors"
            rules={[{ required: true, message: '请输入楼层' }]}
          >
            <InputNumber min={1} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="标签"
            name="tags"
            extra="房源会在自身标签之后自动继承这些楼栋标签。"
          >
            <PropertyTagSelect
              suggestions={tagSuggestions.data?.tags ?? []}
              suggestionsLoading={tagSuggestions.isLoading}
              suggestionsError={tagSuggestions.isError}
            />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(previousValues, currentValues) =>
              previousValues.estate_id !== currentValues.estate_id
            }
          >
            {() => (
              <Form.Item
                label="地址"
                name="address"
                rules={[
                  ({ getFieldValue }) => ({
                    validator: async (_rule, value) => {
                      if (
                        getFieldValue('estate_id') === undefined ||
                        getFieldValue('estate_id') === null
                      ) {
                        if (!String(value || '').trim())
                          throw new Error('非小区楼栋必须填写楼栋地址');
                      }
                    },
                  }),
                ]}
              >
                <Input />
              </Form.Item>
            )}
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={createBuilding.isPending}
          >
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
        <Form
          layout="vertical"
          onFinish={(values) => createLandlord.mutate(values)}
        >
          <Form.Item
            label="姓名"
            name="name"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="手机"
            name="phone"
            rules={[{ required: true, message: '请输入手机号' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="邮箱" name="email">
            <Input />
          </Form.Item>
          <Form.Item label="备注" name="notes">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={createLandlord.isPending}
          >
            保存房东
          </Button>
        </Form>
      </Modal>
    </TenantSelectionGuard>
  );
};

export default HouseNewPage;
