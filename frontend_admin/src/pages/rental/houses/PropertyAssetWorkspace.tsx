import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  RollbackOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { ListToolBar } from '@ant-design/pro-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { history } from '@umijs/max';
import {
  Alert,
  Button,
  Descriptions,
  Empty,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  message,
  Select,
  Skeleton,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useRef, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { LocationPicker } from '@/components/LocationPicker';
import { useTenantWorkspace } from '@/pages/space/shared';
import {
  enumMapping,
  enumSelectOptions,
  useEnums,
} from '@/services/manual/enums';
import {
  type BuildingOut,
  type EstateOut,
  houseApi,
} from '@/services/manual/house';
import { appsSettingsApiListOrgSettings } from '@/services/openapi/organizationSettings';
import MediaRefsUpload from '../components/MediaRefsUpload';
import { PropertyTagSelect } from '../components/PropertyTagSelect';
import { HOUSE_MEDIA_RESOURCE_TYPE, HOUSE_MEDIA_TYPE } from '../constants';
import {
  type DeleteTarget,
  ResourceDeleteModal,
} from '../estates/ResourceDeleteModal';
import { formLocation, settingLocation } from '../location-utils';
import type {
  PropertyAssetAction,
  PropertyAssetScope,
} from './PropertyAssetNavigator';

const BUILDING_PAGE_SIZE = 500;

export type PropertyAssetWorkspaceTab = 'houses' | 'structure' | 'profile';

type EstateProfileValues = {
  name: string;
  display_name: string;
  property_type: string;
  province: string;
  city: string;
  district: string;
  address: string;
  lat?: number | string | null;
  lng?: number | string | null;
};

type BuildingProfileValues = {
  estate_id?: number | null;
  name: string;
  floors: number;
  under_floors?: number | null;
  year_built?: number | null;
  elevator: boolean;
  address: string;
  lat?: number | string | null;
  lng?: number | string | null;
  images?: Record<string, unknown>[];
  tags?: string[];
};

type PropertyAssetProfileValues = EstateProfileValues & BuildingProfileValues;

type PropertyAssetWorkspaceProps = {
  action?: PropertyAssetAction;
  activeTab: PropertyAssetWorkspaceTab;
  buildingId?: number;
  children: React.ReactNode;
  estateId?: number;
  onActionCancel?: () => void;
  onAssetSaved?: (
    kind: 'estate' | 'building',
    asset: EstateOut | BuildingOut,
  ) => void;
  onAssetDeleted?: (kind: 'estate' | 'building', id: number) => void;
  onEditingChange?: (editing: boolean) => void;
  onAction: (action: PropertyAssetAction) => void;
  onScopeChange: (scope: PropertyAssetScope) => void;
  onTabChange: (tab: PropertyAssetWorkspaceTab) => void;
  tabBarExtraContent?: React.ReactNode;
  tabSwitchDisabled?: boolean;
};

const useStyles = createStyles(({ css, token }) => ({
  root: css`
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;
  `,
  profileHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${token.margin}px;
    margin-bottom: ${token.marginLG}px;
    flex-wrap: wrap;
  `,
  profileHeaderActions: css`
    display: flex;
    align-items: center;
    gap: ${token.marginSM}px;
    margin-left: auto;
  `,
  identity: css`
    display: flex;
    align-items: center;
    gap: ${token.marginSM}px;
    min-width: 0;
  `,
  identityIcon: css`
    display: inline-flex;
    width: 38px;
    height: 38px;
    flex: 0 0 38px;
    align-items: center;
    justify-content: center;
    border: 1px solid ${token.colorPrimaryBorder};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
    font-size: ${token.fontSizeLG}px;
  `,
  identityBody: css`
    min-width: 0;
  `,
  breadcrumb: css`
    display: block;
    margin-bottom: 2px;
    font-size: ${token.fontSizeSM}px;
  `,
  titleLine: css`
    display: flex;
    align-items: center;
    gap: ${token.marginXS}px;
    min-width: 0;
    flex-wrap: wrap;

    .ant-typography {
      margin: 0;
    }
  `,
  metadata: css`
    display: flex;
    align-items: center;
    gap: ${token.marginXS}px;
    margin-top: 2px;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
    flex-wrap: wrap;
  `,
  tabs: css`
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;

    > .ant-tabs-nav {
      flex: 0 0 auto;
      margin-bottom: 0;
    }

    > .ant-tabs-content-holder,
    > .ant-tabs-content-holder > .ant-tabs-content,
    > .ant-tabs-content-holder > .ant-tabs-content > .ant-tabs-tabpane {
      min-height: 0;
    }

    > .ant-tabs-content-holder {
      flex: 1;
    }

    > .ant-tabs-content-holder > .ant-tabs-content,
    > .ant-tabs-content-holder > .ant-tabs-content > .ant-tabs-tabpane-active {
      height: 100%;
    }

    > .ant-tabs-content-holder > .ant-tabs-content > .ant-tabs-tabpane-active {
      display: flex;
      min-height: 0;
      flex-direction: column;
    }
  `,
  housesPanel: css`
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;
    gap: ${token.marginSM}px;

    > .ant-pro-table {
      flex: 1;
      min-height: 0;
    }
  `,
  detailLoadAlert: css`
    margin-top: ${token.marginSM}px;
  `,
  panel: css`
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding-block: ${token.padding}px;
  `,
  structurePanel: css`
    flex: 1;
    min-height: 0;
    overflow: auto;
  `,
  buildingImages: css`
    margin-top: ${token.marginLG}px;
  `,
  buildingImagesHeader: css`
    display: flex;
    align-items: baseline;
    gap: ${token.marginXS}px;
    margin-bottom: ${token.marginSM}px;
  `,
  buildingImagesGrid: css`
    display: flex;
    flex-wrap: wrap;
    gap: ${token.marginSM}px;
  `,
  buildingImage: css`
    display: block;
    overflow: hidden;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillAlter};
  `,
  dangerZone: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${token.margin}px;
    margin-top: ${token.marginXL}px;
    padding-top: ${token.padding}px;
    border-top: 1px solid ${token.colorBorderSecondary};

    @media (max-width: ${token.screenSM}px) {
      align-items: flex-start;
      flex-direction: column;
    }
  `,
  formGrid: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0 ${token.margin}px;

    @media (max-width: ${token.screenXL}px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: ${token.screenMD}px) {
      grid-template-columns: 1fr;
    }
  `,
}));

function estateProfileValues(
  estate?: Partial<EstateOut> | EstateProfileValues,
): EstateProfileValues {
  return {
    name: estate?.name || '',
    display_name: estate?.display_name || '',
    property_type: estate?.property_type || '',
    province: estate?.province || '',
    city: estate?.city || '',
    district: estate?.district || '',
    address: estate?.address || '',
    lat: estate?.lat ?? null,
    lng: estate?.lng ?? null,
  };
}

function buildingProfileValues(
  building?: Partial<BuildingOut> | BuildingProfileValues,
): BuildingProfileValues {
  return {
    estate_id: building?.estate_id ?? null,
    name: building?.name || '',
    floors: Number(building?.floors || 0),
    under_floors: building?.under_floors ?? null,
    year_built: building?.year_built ?? null,
    elevator: Boolean(building?.elevator),
    address: building?.address || '',
    lat: building?.lat ?? null,
    lng: building?.lng ?? null,
    images: building?.images || [],
    tags: building?.tags || [],
  };
}

function replaceBuildingNameAtAddressEnd(
  address: string,
  previousName: string,
  nextName: string,
) {
  if (!address || !previousName || !nextName.trim()) return address;
  if (!address.endsWith(previousName)) return address;
  return `${address.slice(0, -previousName.length)}${nextName}`;
}

function displayValue(value?: React.ReactNode) {
  return value || <Typography.Text type="secondary">未填写</Typography.Text>;
}

function buildingImageItems(images?: Record<string, unknown>[]) {
  return (images || []).flatMap((item, index) => {
    const thumbnail =
      typeof item.thumbnail === 'string' ? item.thumbnail : undefined;
    const url = typeof item.url === 'string' ? item.url : undefined;
    const source = thumbnail || url;
    if (!source) return [];

    const label = typeof item.label === 'string' ? item.label : undefined;
    const filename =
      typeof item.original_filename === 'string'
        ? item.original_filename
        : undefined;

    return [
      {
        alt: label || filename || `楼栋图片 ${index + 1}`,
        key:
          typeof item.media_id === 'number'
            ? String(item.media_id)
            : `${source}-${index}`,
        previewSrc: url || source,
        src: source,
      },
    ];
  });
}

function getMapReturnTo() {
  const value = new URLSearchParams(window.location.search).get('return_to');
  return value?.startsWith('/dashboard/rental/properties/map')
    ? value
    : undefined;
}

export function PropertyAssetWorkspace({
  action,
  activeTab,
  buildingId,
  children,
  estateId,
  onActionCancel,
  onAssetDeleted,
  onAssetSaved,
  onEditingChange,
  onAction,
  onScopeChange,
  onTabChange,
  tabBarExtraContent,
  tabSwitchDisabled = false,
}: PropertyAssetWorkspaceProps) {
  const { styles } = useStyles();
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const [buildingSearchDraft, setBuildingSearchDraft] = useState('');
  const [buildingKeyword, setBuildingKeyword] = useState<string>();
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileDirty, setProfileDirty] = useState(false);
  const [pendingBuildingValues, setPendingBuildingValues] =
    useState<PropertyAssetProfileValues | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [profileForm] = Form.useForm<PropertyAssetProfileValues>();
  const previousBuildingNameRef = useRef('');
  const profileEstateId = Form.useWatch('estate_id', profileForm);
  const profileAddress = Form.useWatch('address', profileForm);
  const profileLat = Form.useWatch('lat', profileForm);
  const profileLng = Form.useWatch('lng', profileForm);
  const selectedKind = buildingId ? 'building' : estateId ? 'estate' : null;
  const selectedId = buildingId || estateId;
  const actionKind = action?.type.includes('estate') ? 'estate' : 'building';
  const formKind = action ? actionKind : selectedKind;
  const isCreating =
    action?.type === 'create-estate' || action?.type === 'create-building';
  const showProfileForm = Boolean(action || profileEditing);
  const houseEnums = useEnums(['house.estate_property_type']);

  useEffect(() => {
    setBuildingSearchDraft('');
    setBuildingKeyword(undefined);
  }, [estateId]);

  const allEstates = useQuery({
    queryKey: [
      'house',
      'asset-workspace',
      'all-estates',
      workspace.selectedOrgSlug,
    ],
    queryFn: () => houseApi.listEstates({ page: 1, page_size: 100 }),
    enabled: Boolean(
      workspace.selectedOrgSlug && formKind === 'building' && showProfileForm,
    ),
  });
  const tagSuggestions = useQuery({
    queryKey: ['house', 'tag-suggestions'],
    queryFn: () => houseApi.getTagSuggestions(),
    enabled: Boolean(
      workspace.selectedOrgSlug && formKind === 'building' && showProfileForm,
    ),
  });
  const orgSettings = useQuery({
    queryKey: [
      'settings-management',
      'organization',
      workspace.selectedOrgSlug,
    ],
    queryFn: () => appsSettingsApiListOrgSettings(),
    enabled: Boolean(workspace.selectedOrgSlug && showProfileForm),
  });

  const detail = useQuery<EstateOut | BuildingOut>({
    queryKey:
      selectedKind === 'building'
        ? [
            'house',
            'asset-navigator',
            'selected-building',
            workspace.selectedOrgSlug,
            buildingId,
          ]
        : [
            'house',
            'asset-workspace',
            'estate',
            workspace.selectedOrgSlug,
            estateId,
          ],
    queryFn: () => {
      if (selectedKind === 'building' && buildingId) {
        return houseApi.getBuilding(buildingId);
      }
      if (selectedKind === 'estate' && estateId) {
        return houseApi.getEstate(estateId);
      }
      throw new Error('缺少房源对象 ID');
    },
    enabled: Boolean(workspace.selectedOrgSlug && selectedKind && selectedId),
  });

  const estateBuildings = useQuery({
    queryKey: [
      'house',
      'asset-workspace',
      'buildings',
      workspace.selectedOrgSlug,
      estateId,
      buildingKeyword,
    ],
    queryFn: () =>
      houseApi.listBuildings({
        estate_id: estateId,
        ...(buildingKeyword ? { keyword: buildingKeyword } : {}),
        page: 1,
        page_size: BUILDING_PAGE_SIZE,
      }),
    enabled: Boolean(
      workspace.selectedOrgSlug &&
        selectedKind === 'estate' &&
        estateId &&
        activeTab === 'structure',
    ),
  });

  const estate =
    selectedKind === 'estate'
      ? (detail.data as EstateOut | undefined)
      : undefined;
  const building =
    selectedKind === 'building'
      ? (detail.data as BuildingOut | undefined)
      : undefined;
  const buildingImpact = useQuery({
    queryKey: [
      'house',
      'asset-workspace',
      'building-impact',
      workspace.selectedOrgSlug,
      buildingId,
    ],
    queryFn: () => {
      if (!buildingId) throw new Error('缺少楼栋 ID');
      return houseApi.listHouses({
        building_id: buildingId,
        page: 1,
        page_size: 1,
      });
    },
    enabled: Boolean(
      workspace.selectedOrgSlug && buildingId && pendingBuildingValues,
    ),
  });
  const buildingImages = buildingImageItems(building?.images);
  useEffect(() => {
    setProfileEditing(false);
    setProfileDirty(false);
    setPendingBuildingValues(null);
    previousBuildingNameRef.current = '';
  }, [action?.type, selectedKind, selectedId]);

  useEffect(() => {
    if (activeTab !== 'profile') {
      setProfileEditing(false);
      setProfileDirty(false);
    }
  }, [activeTab]);

  useEffect(() => {
    onEditingChange?.(showProfileForm);
    return () => onEditingChange?.(false);
  }, [onEditingChange, showProfileForm]);

  useEffect(() => {
    if (!showProfileForm || !profileDirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [profileDirty, showProfileForm]);

  const updateProfile = useMutation({
    mutationFn: async (values: PropertyAssetProfileValues) => {
      if (action?.type === 'create-estate') {
        const asset = await houseApi.createEstate(values);
        return { asset, kind: 'estate' as const };
      }
      if (action?.type === 'create-building') {
        const parentEstate =
          selectedProfileEstate?.id === estate?.id
            ? estate
            : selectedProfileEstate || estate;
        const parentLocation = parentEstate ? formLocation(parentEstate) : null;
        const inheritedLocation =
          (values.lat == null || values.lng == null) && parentLocation
            ? {
                ...parentLocation,
                ...(values.address?.trim()
                  ? { address: values.address }
                  : undefined),
              }
            : {};
        const asset = await houseApi.createBuilding({
          ...values,
          ...inheritedLocation,
          estate_id: values.estate_id ?? null,
          floors: Number(values.floors),
        });
        return { asset, kind: 'building' as const };
      }
      if (selectedKind === 'estate' && estateId) {
        const asset = await houseApi.patchEstate(estateId, values);
        return { asset, kind: 'estate' as const };
      }
      if (selectedKind === 'building' && buildingId) {
        const asset = await houseApi.patchBuilding(buildingId, {
          ...values,
          estate_id: values.estate_id ?? null,
          floors: Number(values.floors),
        });
        return { asset, kind: 'building' as const };
      }
      throw new Error('缺少待更新的房源对象');
    },
    onSuccess: async ({ asset, kind }) => {
      setProfileEditing(false);
      setProfileDirty(false);
      setPendingBuildingValues(null);
      message.success(
        isCreating
          ? `${kind === 'estate' ? '项目' : '楼栋'}已创建`
          : `${kind === 'estate' ? '项目' : '楼栋'}资料已保存`,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['house', 'asset-workspace'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['house', 'asset-navigator'],
        }),
        queryClient.invalidateQueries({ queryKey: ['house', 'estates'] }),
        queryClient.invalidateQueries({ queryKey: ['house', 'buildings'] }),
        queryClient.invalidateQueries({ queryKey: ['house', 'houses'] }),
      ]);
      const returnTo = kind === 'building' ? getMapReturnTo() : undefined;
      if (returnTo) {
        const target = new URL(returnTo, window.location.origin);
        target.searchParams.set('selected_building_id', String(asset.id));
        history.push(
          `${target.pathname.replace(/^\/dashboard/, '')}${target.search}${target.hash}`,
        );
        return;
      }
      if (action) onAssetSaved?.(kind, asset);
    },
  });

  const submitProfile = (values: PropertyAssetProfileValues) => {
    const currentEstateId = building?.estate_id ?? building?.estate?.id ?? null;
    const nextEstateId = values.estate_id ?? null;
    if (
      !isCreating &&
      selectedKind === 'building' &&
      currentEstateId !== nextEstateId &&
      (building?.counts?.total ?? 1) > 0
    ) {
      setPendingBuildingValues(values);
      return;
    }
    updateProfile.mutate(values);
  };

  const cancelProfile = () => {
    setProfileEditing(false);
    setProfileDirty(false);
    setPendingBuildingValues(null);
    if (action) onActionCancel?.();
  };

  if ((!selectedKind || !selectedId) && !action) return <>{children}</>;

  const total = estate?.counts?.total ?? building?.counts?.total;
  const entityName =
    action?.type === 'create-estate'
      ? '新建项目'
      : action?.type === 'create-building'
        ? action.estateId
          ? '新建楼栋'
          : '新建独立楼栋'
        : selectedKind === 'estate'
          ? estate?.display_name || estate?.name || `小区 #${selectedId}`
          : building?.name || `楼栋 #${selectedId}`;
  const breadcrumb = isCreating
    ? '房源资产'
    : selectedKind === 'estate'
      ? '住宅小区'
      : building?.estate
        ? building.estate.display_name || building.estate.name
        : '独立楼栋';
  const metadata = isCreating
    ? [
        action.type === 'create-estate'
          ? '在当前页面登记项目资料'
          : action.estateId
            ? `所属项目：${estate?.display_name || estate?.name || `项目 #${action.estateId}`}`
            : '创建不属于项目的独立楼栋',
      ]
    : selectedKind === 'estate'
      ? [
          estate?.building_count === undefined
            ? undefined
            : `${estate.building_count} 栋`,
          total === undefined ? undefined : `${total} 套房源`,
          [estate?.city, estate?.district].filter(Boolean).join(' / '),
        ].filter(Boolean)
      : [
          total === undefined ? undefined : `${total} 套房源`,
          building?.counts
            ? `招租 ${building.counts.listed} · 已租 ${building.counts.rented} · 空置 ${building.counts.vacant}`
            : undefined,
          building?.address,
        ].filter(Boolean);
  const propertyTypeOptions = enumSelectOptions(
    houseEnums.data,
    'house.estate_property_type',
  );
  const selectedProfileEstate = allEstates.data?.items.find(
    (item) => item.id === profileEstateId,
  );
  const defaultLocation = settingLocation(
    orgSettings.data?.find(
      (item) => item.key === 'property_rental.default_location',
    )?.value,
  );
  const profileInitialValues: Partial<PropertyAssetProfileValues> =
    action?.type === 'create-estate'
      ? estateProfileValues({ property_type: 'residential' })
      : action?.type === 'create-building'
        ? buildingProfileValues({
            estate_id: action.estateId ?? null,
            floors: 1,
            elevator: false,
          })
        : formKind === 'estate'
          ? estateProfileValues(estate)
          : buildingProfileValues(building);
  const waitsForDetail =
    !isCreating ||
    Boolean(action?.type === 'create-building' && action.estateId);
  const profileSubmitLabel =
    action?.type === 'create-estate'
      ? '创建项目'
      : action?.type === 'create-building'
        ? '创建楼栋'
        : '保存';

  const profilePanel = (
    <div className={styles.panel}>
      {waitsForDetail && detail.isError ? (
        <Alert
          type="error"
          showIcon
          title={`${formKind === 'estate' ? '项目' : '楼栋'}资料加载失败`}
          description={(detail.error as Error).message}
          action={<Button onClick={() => detail.refetch()}>重试</Button>}
        />
      ) : waitsForDetail && detail.isPending ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : (
        <>
          <header className={styles.profileHeader}>
            <div className={styles.identity}>
              <span className={styles.identityIcon} aria-hidden="true">
                <AppIcon name={formKind === 'estate' ? 'estate' : 'building'} />
              </span>
              <div className={styles.identityBody}>
                <Typography.Text type="secondary" className={styles.breadcrumb}>
                  {breadcrumb}
                </Typography.Text>
                <div className={styles.titleLine}>
                  <Typography.Title level={5}>{entityName}</Typography.Title>
                  <Tag>
                    {isCreating
                      ? '新建'
                      : selectedKind === 'estate'
                        ? '住宅小区'
                        : '楼栋'}
                  </Tag>
                </div>
                {metadata.length ? (
                  <div className={styles.metadata}>{metadata.join(' · ')}</div>
                ) : null}
              </div>
            </div>
            <div className={styles.profileHeaderActions}>
              {showProfileForm ? (
                <>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={updateProfile.isPending}
                    onClick={() => profileForm.submit()}
                  >
                    {profileSubmitLabel}
                  </Button>
                  <Button icon={<RollbackOutlined />} onClick={cancelProfile}>
                    取消
                  </Button>
                </>
              ) : !selectedKind ? null : (
                <>
                  <Button
                    icon={<EyeOutlined />}
                    href={`/dashboard/rental/properties/${selectedKind === 'estate' ? 'estates' : 'buildings'}/${selectedId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    查看详情
                  </Button>
                  <Button
                    aria-label={`编辑${selectedKind === 'estate' ? '项目' : '楼栋'}资料`}
                    icon={<EditOutlined />}
                    disabled={tabSwitchDisabled}
                    onClick={() => {
                      previousBuildingNameRef.current = building?.name || '';
                      setProfileEditing(true);
                    }}
                  >
                    编辑
                  </Button>
                </>
              )}
            </div>
          </header>
          {showProfileForm ? (
            <Form
              key={
                action
                  ? `${action.type}-${action.type === 'create-building' ? action.estateId || 'standalone' : selectedId || 'new'}`
                  : `${selectedKind}-${selectedId}`
              }
              form={profileForm}
              initialValues={profileInitialValues}
              layout="vertical"
              onFinish={submitProfile}
              onValuesChange={(changedValues, values) => {
                setProfileDirty(true);
                if (
                  formKind !== 'building' ||
                  typeof changedValues.name !== 'string'
                ) {
                  return;
                }
                const nextName = changedValues.name;
                if (!nextName.trim()) return;
                const previousName =
                  previousBuildingNameRef.current ||
                  String(profileInitialValues.name || '');
                previousBuildingNameRef.current = nextName;
                const nextAddress = replaceBuildingNameAtAddressEnd(
                  values.address || '',
                  previousName,
                  nextName,
                );
                if (nextAddress !== values.address) {
                  profileForm.setFieldValue('address', nextAddress);
                }
              }}
            >
              {formKind === 'estate' ? (
                <div className={styles.formGrid}>
                  <Form.Item
                    label="项目名称"
                    name="name"
                    rules={[{ required: true, message: '请输入项目名称' }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item label="展示名称" name="display_name">
                    <Input placeholder="不填写时使用项目名称" />
                  </Form.Item>
                  <Form.Item label="物业类型" name="property_type">
                    <Select
                      allowClear
                      options={propertyTypeOptions}
                      placeholder="请选择物业类型"
                    />
                  </Form.Item>
                  <Form.Item
                    label="省份"
                    name="province"
                    rules={[{ required: true, message: '请输入省份' }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item
                    label="城市"
                    name="city"
                    rules={[{ required: true, message: '请输入城市' }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item
                    label="区域"
                    name="district"
                    rules={[{ required: true, message: '请输入区域' }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item label="详细地址" name="address">
                    <Input placeholder="例如：科技园路 1 号" />
                  </Form.Item>
                  <Form.Item name="lat" hidden>
                    <Input />
                  </Form.Item>
                  <Form.Item name="lng" hidden>
                    <Input />
                  </Form.Item>
                  <Form.Item label="项目位置" style={{ gridColumn: '1 / -1' }}>
                    <LocationPicker
                      ariaLabel="项目位置"
                      value={formLocation({
                        address: profileAddress,
                        lat: profileLat,
                        lng: profileLng,
                      })}
                      fallbackLocation={defaultLocation}
                      onChange={(location) =>
                        profileForm.setFieldsValue(
                          location || { lat: null, lng: null },
                        )
                      }
                      allowClear
                    />
                  </Form.Item>
                </div>
              ) : (
                <div className={styles.formGrid}>
                  <Form.Item
                    label="楼栋名"
                    name="name"
                    rules={[{ required: true, message: '请输入楼栋名' }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item label="所属项目" name="estate_id">
                    <Select
                      allowClear
                      loading={allEstates.isLoading}
                      options={(allEstates.data?.items || []).map((item) => ({
                        label: item.display_name || item.name,
                        value: item.id,
                      }))}
                      placeholder="不选择时为独立楼栋"
                    />
                  </Form.Item>
                  <Form.Item
                    label="地上楼层"
                    name="floors"
                    rules={[{ required: true, message: '请输入地上楼层' }]}
                  >
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item label="地下楼层" name="under_floors">
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item label="建成年份" name="year_built">
                    <InputNumber
                      min={1900}
                      max={2100}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  <Form.Item
                    label="电梯"
                    name="elevator"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  <Form.Item
                    label="详细地址"
                    name="address"
                    style={{ gridColumn: '1 / -1' }}
                    rules={[
                      {
                        required: true,
                        whitespace: true,
                        message: '请输入楼栋地址',
                      },
                    ]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item name="lat" hidden>
                    <Input />
                  </Form.Item>
                  <Form.Item name="lng" hidden>
                    <Input />
                  </Form.Item>
                  <Form.Item label="楼栋位置">
                    <LocationPicker
                      ariaLabel="楼栋位置"
                      value={formLocation({
                        address: profileAddress,
                        lat: profileLat,
                        lng: profileLng,
                      })}
                      fallbackLocation={
                        (selectedProfileEstate &&
                          formLocation(selectedProfileEstate)) ||
                        defaultLocation
                      }
                      onChange={(location) =>
                        profileForm.setFieldsValue(
                          location || { lat: null, lng: null },
                        )
                      }
                      allowClear
                    />
                  </Form.Item>
                  <Form.Item
                    label="楼栋标签"
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
                    label="楼栋图片"
                    name="images"
                    extra="最多上传 9 张，第一张将作为楼栋首图。"
                    style={{ gridColumn: '1 / -1' }}
                  >
                    <MediaRefsUpload
                      resourceType={HOUSE_MEDIA_RESOURCE_TYPE.BUILDING_IMAGE}
                      mediaType={HOUSE_MEDIA_TYPE.IMAGE}
                      maxCount={9}
                      enableImageRoles={false}
                    />
                  </Form.Item>
                </div>
              )}
            </Form>
          ) : (
            <>
              <Descriptions
                layout="vertical"
                column={{ xs: 1, sm: 1, md: 2, lg: 2, xl: 3, xxl: 3 }}
                items={
                  selectedKind === 'estate'
                    ? [
                        {
                          key: 'name',
                          label: '项目名称',
                          children: displayValue(estate?.name),
                        },
                        {
                          key: 'display_name',
                          label: '展示名称',
                          children: displayValue(estate?.display_name),
                        },
                        {
                          key: 'property_type',
                          label: '物业类型',
                          children: displayValue(
                            enumMapping(
                              estate?.property_type,
                              estate?.property_type__mapping,
                            ),
                          ),
                        },
                        {
                          key: 'region',
                          label: '所在区域',
                          children: displayValue(
                            [estate?.province, estate?.city, estate?.district]
                              .filter(Boolean)
                              .join(' / '),
                          ),
                        },
                        {
                          key: 'address',
                          label: '详细地址',
                          children: displayValue(estate?.address),
                        },
                        {
                          key: 'location',
                          label: '地图位置',
                          children:
                            estate?.lat == null || estate?.lng == null
                              ? displayValue()
                              : '已定位',
                        },
                        {
                          key: 'inventory',
                          label: '资产规模',
                          children: displayValue(
                            estate?.building_count === undefined &&
                              total === undefined
                              ? undefined
                              : `${estate?.building_count || 0} 栋 · ${total || 0} 套`,
                          ),
                        },
                      ]
                    : [
                        {
                          key: 'name',
                          label: '楼栋名称',
                          children: displayValue(building?.name),
                        },
                        {
                          key: 'estate',
                          label: '所属项目',
                          children: displayValue(
                            building?.estate?.display_name ||
                              building?.estate?.name,
                          ),
                        },
                        {
                          key: 'floors',
                          label: '地上楼层',
                          children: `${building?.floors || 0} 层`,
                        },
                        {
                          key: 'under_floors',
                          label: '地下楼层',
                          children:
                            building?.under_floors == null
                              ? displayValue()
                              : `${building.under_floors} 层`,
                        },
                        {
                          key: 'year_built',
                          label: '建成年份',
                          children: displayValue(building?.year_built),
                        },
                        {
                          key: 'elevator',
                          label: '电梯',
                          children: building?.elevator ? '有' : '无',
                        },
                        {
                          key: 'address',
                          label: '详细地址',
                          children: displayValue(building?.address),
                          span: 'filled',
                        },
                        {
                          key: 'location',
                          label: '地图位置',
                          children:
                            building?.lat == null || building?.lng == null
                              ? displayValue()
                              : '已定位',
                        },
                        {
                          key: 'tags',
                          label: '楼栋标签',
                          children: building?.tags?.length ? (
                            <Space size={[4, 4]} wrap>
                              {building.tags.map((tag) => (
                                <Tag key={tag}>{tag}</Tag>
                              ))}
                            </Space>
                          ) : (
                            displayValue()
                          ),
                        },
                      ]
                }
              />
              {selectedKind === 'building' ? (
                <section
                  aria-label="楼栋图片"
                  className={styles.buildingImages}
                >
                  <div className={styles.buildingImagesHeader}>
                    <Typography.Text strong>楼栋图片</Typography.Text>
                  </div>
                  {buildingImages.length ? (
                    <Image.PreviewGroup>
                      <div className={styles.buildingImagesGrid}>
                        {buildingImages.map((image) => (
                          <Image
                            alt={image.alt}
                            height={84}
                            key={image.key}
                            preview={{ src: image.previewSrc }}
                            rootClassName={styles.buildingImage}
                            src={image.src}
                            styles={{ image: { objectFit: 'cover' } }}
                            width={112}
                          />
                        ))}
                      </div>
                    </Image.PreviewGroup>
                  ) : (
                    displayValue()
                  )}
                </section>
              ) : null}
              <div className={styles.dangerZone}>
                <div>
                  <Typography.Text strong>危险操作</Typography.Text>
                  <br />
                  <Typography.Text type="secondary">
                    删除前会检查关联的
                    {selectedKind === 'estate' ? '楼栋' : '房源'}
                    ，确认没有占用后才可继续。
                  </Typography.Text>
                </div>
                <Button
                  danger
                  aria-label={`删除${selectedKind === 'estate' ? '项目' : '楼栋'}`}
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    if (!selectedKind || !selectedId) return;
                    setDeleteTarget({
                      type: selectedKind,
                      id: selectedId,
                      label: entityName,
                    });
                  }}
                >
                  删除{selectedKind === 'estate' ? '项目' : '楼栋'}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );

  const structurePanel = (
    <div className={styles.structurePanel}>
      <ListToolBar
        title={
          <Space size="small">
            <Typography.Text strong>楼栋列表</Typography.Text>
          </Space>
        }
        actions={[
          <Input.Search
            key="building-keyword"
            allowClear
            aria-label="搜索楼栋名称或地址"
            placeholder="搜索楼栋名称或地址"
            value={buildingSearchDraft}
            onChange={(event) => {
              const nextValue = event.target.value;
              setBuildingSearchDraft(nextValue);
              if (!nextValue && buildingKeyword) {
                setBuildingKeyword(undefined);
              }
            }}
            onSearch={(value) => {
              setBuildingSearchDraft(value);
              setBuildingKeyword(value.trim() || undefined);
            }}
            style={{ width: 240 }}
          />,
          <Button
            key="create-building"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => onAction({ type: 'create-building', estateId })}
          >
            新建楼栋
          </Button>,
        ]}
      />
      {estateBuildings.isError ? (
        <Alert
          type="error"
          showIcon
          title="楼栋列表加载失败"
          description={(estateBuildings.error as Error).message}
          action={
            <Button onClick={() => estateBuildings.refetch()}>重试</Button>
          }
        />
      ) : estateBuildings.isPending ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : (
        <Table<BuildingOut>
          rowKey="id"
          dataSource={estateBuildings.data?.items || []}
          pagination={false}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="当前小区暂无楼栋"
              >
                <Button
                  type="primary"
                  onClick={() =>
                    onAction({ type: 'create-building', estateId })
                  }
                >
                  新建楼栋
                </Button>
              </Empty>
            ),
          }}
          scroll={{ x: 'max-content' }}
          columns={[
            {
              title: '楼栋',
              dataIndex: 'name',
              render: (value, record) => (
                <Button
                  type="link"
                  onClick={() => onScopeChange({ buildingId: record.id })}
                >
                  {value}
                </Button>
              ),
            },
            {
              title: '房源数量',
              dataIndex: ['counts', 'total'],
              align: 'right',
              render: (value) =>
                value === undefined ? '统计中…' : `${value} 套`,
            },
            {
              title: '房态',
              key: 'inventory',
              render: (_value, record) =>
                record.counts
                  ? `招租 ${record.counts.listed} · 已租 ${record.counts.rented} · 空置 ${record.counts.vacant}`
                  : '暂无统计',
            },
            {
              title: '地址',
              dataIndex: 'address',
              render: (value) => value || '未填写',
            },
            {
              title: '操作',
              key: 'actions',
              align: 'center',
              render: (_value, record) => (
                <Space>
                  <Button
                    type="link"
                    href={`/dashboard/rental/properties/buildings/${record.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    查看楼栋
                  </Button>
                  <Button
                    type="link"
                    onClick={() =>
                      onAction({
                        type: 'edit-building',
                        buildingId: record.id,
                      })
                    }
                  >
                    编辑资料
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      )}
    </div>
  );

  const tabItems = [
    {
      key: 'houses',
      label: total === undefined ? '房源' : `房源（${total}）`,
      children: (
        <div className={styles.housesPanel}>
          {!action && detail.isError ? (
            <Alert
              className={styles.detailLoadAlert}
              type="warning"
              showIcon
              title="对象资料暂时无法加载，房源筛选仍可继续使用"
              action={<Button onClick={() => detail.refetch()}>重试</Button>}
            />
          ) : null}
          {children}
        </div>
      ),
    },
    ...(selectedKind === 'estate'
      ? [
          {
            key: 'structure',
            label:
              estate?.building_count === undefined
                ? '楼栋'
                : `楼栋（${estate.building_count}）`,
            children: structurePanel,
          },
        ]
      : []),
    {
      key: 'profile',
      label: selectedKind === 'estate' ? '项目资料' : '楼栋资料',
      children: profilePanel,
    },
  ].map((item) => ({
    ...item,
    disabled: (showProfileForm || tabSwitchDisabled) && item.key !== activeTab,
  }));

  return (
    <section className={styles.root} aria-label="房源对象工作区">
      {isCreating ? (
        profilePanel
      ) : (
        <Tabs
          className={styles.tabs}
          activeKey={activeTab}
          destroyOnHidden={false}
          items={tabItems}
          tabBarExtraContent={{ left: tabBarExtraContent }}
          onChange={(key) => onTabChange(key as PropertyAssetWorkspaceTab)}
        />
      )}
      <Modal
        open={Boolean(pendingBuildingValues)}
        title="确认调整楼栋归属"
        okText="确认调整"
        cancelText="返回检查"
        confirmLoading={updateProfile.isPending}
        okButtonProps={{
          disabled: buildingImpact.isPending || buildingImpact.isError,
        }}
        onCancel={() => setPendingBuildingValues(null)}
        onOk={() => {
          if (!pendingBuildingValues) return;
          updateProfile.mutate(pendingBuildingValues);
        }}
      >
        {buildingImpact.isError ? (
          <Alert
            type="error"
            showIcon
            title="影响房源数量统计失败"
            description="请重试统计后再确认调整楼栋归属。"
            action={
              <Button onClick={() => buildingImpact.refetch()}>重新统计</Button>
            }
          />
        ) : (
          <Typography.Text>
            {buildingImpact.isPending
              ? '正在统计受影响房源…'
              : `调整后，“${building?.name || '当前楼栋'}”下 ${buildingImpact.data?.total || 0} 套房源将一并归入${selectedProfileEstate ? `“${selectedProfileEstate.display_name || selectedProfileEstate.name}”` : '独立楼栋'}范围。`}
          </Typography.Text>
        )}
      </Modal>
      <ResourceDeleteModal
        open={Boolean(deleteTarget)}
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={async () => {
          if (!deleteTarget) return;
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: ['house', 'asset-workspace'],
            }),
            queryClient.invalidateQueries({
              queryKey: ['house', 'asset-navigator'],
            }),
            queryClient.invalidateQueries({ queryKey: ['house', 'estates'] }),
            queryClient.invalidateQueries({ queryKey: ['house', 'buildings'] }),
            queryClient.invalidateQueries({ queryKey: ['house', 'houses'] }),
          ]);
          onAssetDeleted?.(deleteTarget.type, deleteTarget.id);
        }}
      />
    </section>
  );
}
