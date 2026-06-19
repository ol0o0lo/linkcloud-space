import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Form, Image, Input, List, Modal, Skeleton, Space, Upload, message } from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import React, { useCallback, useMemo, useState } from 'react';
import { appsMediaApiUploadFiles } from '@/services/openapi/mediaFiles';
import { appsAccountsApiGetMyRealName, appsAccountsApiRetryMyRealName, appsAccountsApiSubmitMyRealName } from '@/services/openapi/realName';
import type { CurrentUser } from '../data';
import { listAuthenticators, queryCurrent } from '../service';
import { SecurityModals } from './security.modals';
import type {
  AuthenticatorSummary,
  SecurityAction,
  SecurityItem,
} from './security.types';
import { buildMfaDescription, maskEmail, maskPhone } from './security.utils';

const SecurityView: React.FC = () => {
  const [activeModal, setActiveModal] = useState<SecurityAction | null>(null);
  const [realNameModalOpen, setRealNameModalOpen] = useState(false);
  const [idCardMedia, setIdCardMedia] = useState<IdCardMediaRef[]>([]);
  const [realNameForm] = Form.useForm<RealNameFormValues>();

  const {
    data: currentUser,
    isLoading: currentUserLoading,
    error: currentUserError,
  } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => queryCurrent().then((res) => res.data),
  });

  const {
    data: authenticators = [],
    isLoading: authenticatorsLoading,
    error: authenticatorsError,
  } = useQuery({
    queryKey: ['security-authenticators'],
    queryFn: async () => {
      const authenticators = await listAuthenticators();
      return authenticators as AuthenticatorSummary[];
    },
  });
  const {
    data: realNameStatus,
    isLoading: realNameLoading,
    error: realNameError,
    refetch: refetchRealName,
  } = useQuery({
    queryKey: ['security-real-name'],
    queryFn: () => appsAccountsApiGetMyRealName(),
  });

  const submitRealNameMutation = useMutation({
    mutationFn: (payload: RealNameSubmitPayload) => appsAccountsApiSubmitMyRealName({ ...payload, source: 'user_submit' }),
    onSuccess: async () => {
      message.success('实名认证已提交');
      realNameForm.resetFields();
      setIdCardMedia([]);
      setRealNameModalOpen(false);
      await refetchRealName();
    },
  });
  const retryRealNameMutation = useMutation({
    mutationFn: (payload: RealNameSubmitPayload) => appsAccountsApiRetryMyRealName({ ...payload, source: 'user_submit' }),
    onSuccess: async () => {
      message.success('实名认证已重新提交');
      realNameForm.resetFields();
      setIdCardMedia([]);
      setRealNameModalOpen(false);
      await refetchRealName();
    },
  });
  const uploadIdCardMutation = useMutation({
    mutationFn: ({ side, file }: { side: IdCardSide; file: File }) =>
      appsMediaApiUploadFiles({ resource_type: 'real_name_id_card', scope: 'user' }, [file]).then((items) => ({ side, media: items[0] })),
    onSuccess: ({ side, media }) => {
      setIdCardMedia((previous) => {
        const next = previous.filter((item) => item.side !== side);
        return [...next, buildIdCardMediaRef(side, media)];
      });
      message.success(`${getIdCardSideLabel(side)}已上传`);
    },
  });

  const items = useMemo<SecurityItem[]>(() => {
    const user = currentUser as CurrentUser | undefined;
    const realNameDescription = buildRealNameDescription(realNameStatus);
    return [
      {
        key: 'password',
        title: '账户密码',
        description: '已设置登录密码',
        actionText: '修改',
      },
      {
        key: 'phone',
        title: '密保手机',
        description: maskPhone(
          user?.phone_country_code,
          user?.phone_national_number,
        ),
        actionText: user?.phone_national_number ? '修改' : '绑定',
      },
      {
        key: 'email',
        title: '邮箱地址',
        description: maskEmail(user?.email),
        actionText: user?.email ? '修改' : '绑定',
      },
      {
        key: 'mfa',
        title: 'MFA 设备',
        description: buildMfaDescription(authenticators),
        actionText: authenticators.length ? '管理' : '绑定',
      },
      {
        key: 'real-name',
        title: '实名认证',
        description: realNameDescription,
        actionText: getRealNameActionText(realNameStatus?.status),
      },
    ];
  }, [authenticators, currentUser, realNameStatus]);


  const canRetry = isRetryableRealNameStatus(realNameStatus?.status);
  const canEditRealName = canRetry || !realNameStatus?.id || realNameStatus?.status === 'unverified';
  const realNameHelper = getRealNameHelper(realNameStatus);
  const openRealNameModal = useCallback(() => {
    if (canRetry && realNameStatus?.id_card_media?.length) {
      setIdCardMedia(
        sortIdCardMedia(realNameStatus.id_card_media as IdCardMediaRef[]),
      );
    } else {
      setIdCardMedia([]);
    }
    realNameForm.resetFields();
    setRealNameModalOpen(true);
  }, [canRetry, realNameForm, realNameStatus]);

  if (currentUserLoading || authenticatorsLoading || realNameLoading) {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }

  return (
    <>
      {currentUserError || authenticatorsError || realNameError ? (
        <Alert
          showIcon
          style={{ marginBottom: 16 }}
          type="error"
          title="安全设置加载失败，请稍后重试"
        />
      ) : null}
      <List<SecurityItem>
        itemLayout="horizontal"
        dataSource={items}
        renderItem={(item) => (
          <List.Item
            actions={[
              <a
                key={item.key}
                onClick={() => {
                  if (item.key === 'real-name') {
                    openRealNameModal();
                    return;
                  }
                  setActiveModal(item.key);
                }}
              >
                {item.actionText}
              </a>,
            ]}
          >
            <List.Item.Meta title={item.title} description={item.description} />
          </List.Item>
        )}
      />
      <Modal
        open={realNameModalOpen}
        title="实名认证"
        onCancel={() => setRealNameModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          {realNameHelper ? (
            <Alert showIcon type={realNameHelper.type} message={realNameHelper.message} description={realNameHelper.description} />
          ) : null}
          {!canEditRealName && realNameStatus?.id_card_media?.length ? (
            <IdCardPreview items={realNameStatus.id_card_media as IdCardMediaPreviewItem[]} />
          ) : null}
          {canEditRealName ? (
            <Form
              form={realNameForm}
              layout="vertical"
              onFinish={(values) => {
                const payload = { ...values, id_card_media: sortIdCardMedia(idCardMedia) };
                if (!hasBothIdCardSides(payload.id_card_media)) {
                  message.error('请上传身份证人像面和国徽面');
                  return;
                }
                if (canRetry) {
                  retryRealNameMutation.mutate(payload);
                  return;
                }
                submitRealNameMutation.mutate(payload);
              }}
            >
              <Form.Item label="真实姓名" name="real_name" rules={[{ required: true, message: '请输入真实姓名' }]}>
                <Input placeholder={canRetry && realNameStatus?.real_name_masked ? `上次提交：${realNameStatus.real_name_masked}` : undefined} />
              </Form.Item>
              <Form.Item label="身份证号" name="id_number" rules={[{ required: true, message: '请输入身份证号' }]}>
                <Input placeholder={canRetry && realNameStatus?.id_number_masked ? `上次提交：${realNameStatus.id_number_masked}` : undefined} />
              </Form.Item>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <IdCardUpload
                  label="身份证人像面"
                  side="front"
                  uploadedMedia={idCardMedia.find((item) => item.side === 'front')?.url ? idCardMedia.find((item) => item.side === 'front') : undefined}
                  loading={uploadIdCardMutation.isPending}
                  onUpload={handleIdCardUpload(uploadIdCardMutation.mutate, 'front')}
                  onRemove={() => setIdCardMedia((prev) => prev.filter((item) => item.side !== 'front'))}
                />
                <IdCardUpload
                  label="身份证国徽面"
                  side="back"
                  uploadedMedia={idCardMedia.find((item) => item.side === 'back')?.url ? idCardMedia.find((item) => item.side === 'back') : undefined}
                  loading={uploadIdCardMutation.isPending}
                  onUpload={handleIdCardUpload(uploadIdCardMutation.mutate, 'back')}
                  onRemove={() => setIdCardMedia((prev) => prev.filter((item) => item.side !== 'back'))}
                />
              </div>
              <Form.Item>
                <Button loading={submitRealNameMutation.isPending || retryRealNameMutation.isPending} type="primary" htmlType="submit">
                  {canRetry ? '重新提交' : '提交实名'}
                </Button>
              </Form.Item>
            </Form>
          ) : null}
        </Space>
      </Modal>
      <SecurityModals
        activeModal={activeModal}
        currentUser={currentUser}
        onClose={() => setActiveModal(null)}
      />
    </>
  );
};

type IdCardSide = 'front' | 'back';

type IdCardMediaRef = {
  media_id: number;
  media_type: 'image';
  label: string;
  side: IdCardSide;
  url?: string;
};

type IdCardMediaPreviewItem = {
  media_id: number;
  media_type?: string;
  label?: string;
  side?: IdCardSide;
  url?: string;
  thumbnail?: string | null;
  original_filename?: string;
};

type RealNameFormValues = {
  real_name: string;
  id_number: string;
};

type RealNameSubmitPayload = RealNameFormValues & {
  id_card_media: IdCardMediaRef[];
  source?: string;
};

type InlineRealNameHelper = {
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  description?: string;
};

function getIdCardSideLabel(side: IdCardSide) {
  return side === 'front' ? '身份证人像面' : '身份证国徽面';
}

function buildIdCardMediaRef(side: IdCardSide, media: API.MediaFileOut): IdCardMediaRef {
  return {
    media_id: media.id,
    media_type: 'image',
    label: getIdCardSideLabel(side),
    side,
    url: media.url ?? undefined,
  };
}

function sortIdCardMedia(media: IdCardMediaRef[]) {
  return ['front', 'back'].map((side) => media.find((item) => item.side === side)).filter(Boolean) as IdCardMediaRef[];
}

function hasBothIdCardSides(media: IdCardMediaRef[]) {
  return media.some((item) => item.side === 'front') && media.some((item) => item.side === 'back');
}

function handleIdCardUpload(mutate: (payload: { side: IdCardSide; file: File }) => void, side: IdCardSide): UploadProps['customRequest'] {
  return (options) => {
    const file = options.file as File;
    mutate({ side, file });
    options.onSuccess?.({} as never);
  };
}

const IdCardUpload: React.FC<{
  label: string;
  side: IdCardSide;
  uploadedMedia?: IdCardMediaRef;
  loading: boolean;
  onUpload: UploadProps['customRequest'];
  onRemove: () => void;
}> = ({ label, side, uploadedMedia, loading, onUpload, onRemove }) => {
  const fileList: UploadFile[] = uploadedMedia
    ? [{
        uid: String(uploadedMedia.media_id),
        name: uploadedMedia.label || label,
        status: 'done',
        url: uploadedMedia.url,
      }]
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 14, color: 'rgba(0,0,0,0.88)' }}>{label}</span>
      <Upload
        accept="image/png,image/jpeg,image/webp"
        customRequest={onUpload}
        maxCount={1}
        listType="picture-card"
        fileList={fileList}
        onRemove={onRemove}
      >
        {fileList.length >= 1 ? null : (loading ? <span style={{ color: '#999' }}>上传中...</span> : <span style={{ fontSize: 12, color: '#999' }}>点击上传</span>)}
      </Upload>
    </div>
  );
};

const IdCardPreview: React.FC<{ items: IdCardMediaPreviewItem[] }> = ({ items }) => {
  const front = items.find((item) => item.side === 'front');
  const back = items.find((item) => item.side === 'back');
  const previewItems = [
    front || { label: '身份证人像面', side: 'front' as IdCardSide, url: undefined },
    back || { label: '身份证国徽面', side: 'back' as IdCardSide, url: undefined },
  ];

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {previewItems.map((item) => (
        <div key={item.side} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 14, color: 'rgba(0,0,0,0.88)' }}>{item.label || getIdCardSideLabel(item.side!)}</span>
          <div style={{
            width: 104,
            height: 104,
            borderRadius: 8,
            border: '1px solid #d9d9d9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            background: '#fafafa',
          }}>
            {item.url ? (
              <Image
                src={item.url}
                alt={item.label || getIdCardSideLabel(item.side!)}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                preview={{ mask: '查看大图' }}
              />
            ) : (
              <span style={{ color: '#bfbfbf', fontSize: 12 }}>暂无图片</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

function isRetryableRealNameStatus(status?: string) {
  return status === 'rejected' || status === 'revoked';
}

function getRealNameActionText(status?: string) {
  if (isRetryableRealNameStatus(status)) {
    return '重新提交';
  }
  if (status === 'verified' || status === 'pending' || status === 'manual_review') {
    return '查看';
  }
  return '去认证';
}

function buildRealNameDescription(realNameStatus?: API.RealNameVerificationOut) {
  if (realNameStatus?.real_name_masked) {
    return `${realNameStatus.status_label} · ${realNameStatus.real_name_masked}`;
  }
  return realNameStatus?.status_label || '未认证';
}

function getRealNameHelper(realNameStatus?: API.RealNameVerificationOut): InlineRealNameHelper {
  const status = realNameStatus?.status || 'unverified';
  if (status === 'verified') {
    return {
      type: 'success',
      message: '当前账号已完成实名认证',
      description: realNameStatus?.real_name_masked ? `认证姓名：${realNameStatus.real_name_masked}` : undefined,
    };
  }
  if (status === 'pending') {
    return {
      type: 'info',
      message: '实名认证审核中',
      description: '已提交后无需重复操作，请等待审核结果。',
    };
  }
  if (status === 'manual_review') {
    return {
      type: 'warning',
      message: '实名认证正在人工复核',
      description: realNameStatus?.failure_reason || realNameStatus?.review_note || '请耐心等待审核结果。',
    };
  }
  if (isRetryableRealNameStatus(status)) {
    return {
      type: 'error',
      message: '实名认证未通过',
      description: realNameStatus?.failure_reason || realNameStatus?.review_note || '请核对信息后重新提交。',
    };
  }
  return {
    type: 'info',
    message: '请完成实名认证',
    description: '实名认证已并入安全设置，提交后会在这里查看结果。',
  };
}

export default SecurityView;
