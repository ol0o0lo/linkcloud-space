import { useMutation, useQuery } from '@tanstack/react-query';
import type { UploadFile, UploadProps } from 'antd';
import {
  Alert,
  Button,
  Form,
  Image,
  Input,
  List,
  Modal,
  message,
  Skeleton,
  Space,
  Upload,
} from 'antd';
import React, { useCallback, useMemo, useState } from 'react';
import { appsMediaApiUploadFiles } from '@/services/openapi/mediaFiles';
import {
  appsAccountsApiGetMyRealName,
  appsAccountsApiRetryMyRealName,
  appsAccountsApiSubmitMyRealName,
} from '@/services/openapi/realName';
import { enumMapping } from '@/services/manual/enums';
import type { SecurityItem } from './security.types';

type RealNameStatusRecord = API.RealNameVerificationOut & {
  status__mapping?: string;
  source__mapping?: string;
  provider__mapping?: string;
};

export const RealNameView: React.FC = () => {
  const [realNameModalOpen, setRealNameModalOpen] = useState(false);
  const [idCardMedia, setIdCardMedia] = useState<IdCardMediaRef[]>([]);
  const [realNameForm] = Form.useForm<RealNameFormValues>();

  const {
    data: realNameStatus,
    isLoading: realNameLoading,
    error: realNameError,
    refetch: refetchRealName,
  } = useQuery({
    queryKey: ['security-real-name'],
    queryFn: () => appsAccountsApiGetMyRealName() as Promise<RealNameStatusRecord>,
  });

  const submitRealNameMutation = useMutation({
    mutationFn: (payload: RealNameSubmitPayload) =>
      appsAccountsApiSubmitMyRealName({ ...payload, source: 'user_submit' }),
    onSuccess: async () => {
      message.success('实名认证已提交');
      realNameForm.resetFields();
      setIdCardMedia([]);
      setRealNameModalOpen(false);
      await refetchRealName();
    },
  });
  const retryRealNameMutation = useMutation({
    mutationFn: (payload: RealNameSubmitPayload) =>
      appsAccountsApiRetryMyRealName({ ...payload, source: 'user_submit' }),
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
      appsMediaApiUploadFiles(
        { resource_type: 'real_name_id_card', scope: 'user' },
        [file],
      ).then((items) => ({ side, media: items[0] })),
    onSuccess: ({ side, media }) => {
      setIdCardMedia((previous) => {
        const next = previous.filter((item) => item.side !== side);
        return [...next, buildIdCardMediaRef(side, media)];
      });
      message.success(`${getIdCardSideLabel(side)}已上传`);
    },
  });

  const items = useMemo<SecurityItem[]>(
    () => [
      {
        key: 'real-name',
        title: '实名认证',
        description: buildRealNameDescription(realNameStatus),
        actionText: getRealNameActionText(realNameStatus?.status),
      },
    ],
    [realNameStatus],
  );

  const canRetry = isRetryableRealNameStatus(realNameStatus?.status);
  const canEditRealName =
    canRetry || !realNameStatus?.id || realNameStatus?.status === 'unverified';
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

  if (realNameLoading) {
    return <Skeleton active paragraph={{ rows: 2 }} />;
  }

  return (
    <>
      {realNameError ? (
        <Alert
          showIcon
          style={{ marginBottom: 16 }}
          type="error"
          title="实名认证状态加载失败，请稍后重试"
        />
      ) : null}
      <List<SecurityItem>
        itemLayout="horizontal"
        dataSource={items}
        renderItem={(item) => (
          <List.Item
            actions={[
              <a key={item.key} onClick={openRealNameModal}>
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
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {realNameHelper ? (
            <Alert
              showIcon
              type={realNameHelper.type}
              message={realNameHelper.message}
              description={realNameHelper.description}
            />
          ) : null}
          {!canEditRealName && realNameStatus?.id_card_media?.length ? (
            <IdCardPreview
              items={realNameStatus.id_card_media as IdCardMediaPreviewItem[]}
            />
          ) : null}
          {canEditRealName ? (
            <Form
              form={realNameForm}
              layout="vertical"
              onFinish={(values) => {
                const payload = {
                  ...values,
                  id_card_media: sortIdCardMedia(idCardMedia),
                };
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
              <Form.Item
                label="真实姓名"
                name="real_name"
                rules={[{ required: true, message: '请输入真实姓名' }]}
              >
                <Input
                  placeholder={
                    canRetry && realNameStatus?.real_name_masked
                      ? `上次提交：${realNameStatus.real_name_masked}`
                      : undefined
                  }
                />
              </Form.Item>
              <Form.Item
                label="身份证号"
                name="id_number"
                rules={[{ required: true, message: '请输入身份证号' }]}
              >
                <Input
                  placeholder={
                    canRetry && realNameStatus?.id_number_masked
                      ? `上次提交：${realNameStatus.id_number_masked}`
                      : undefined
                  }
                />
              </Form.Item>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <IdCardUpload
                  label="身份证人像面"
                  uploadedMedia={
                    idCardMedia.find((item) => item.side === 'front')?.url
                      ? idCardMedia.find((item) => item.side === 'front')
                      : undefined
                  }
                  loading={uploadIdCardMutation.isPending}
                  onUpload={handleIdCardUpload(
                    uploadIdCardMutation.mutate,
                    'front',
                  )}
                  onRemove={() =>
                    setIdCardMedia((prev) =>
                      prev.filter((item) => item.side !== 'front'),
                    )
                  }
                />
                <IdCardUpload
                  label="身份证国徽面"
                  uploadedMedia={
                    idCardMedia.find((item) => item.side === 'back')?.url
                      ? idCardMedia.find((item) => item.side === 'back')
                      : undefined
                  }
                  loading={uploadIdCardMutation.isPending}
                  onUpload={handleIdCardUpload(
                    uploadIdCardMutation.mutate,
                    'back',
                  )}
                  onRemove={() =>
                    setIdCardMedia((prev) =>
                      prev.filter((item) => item.side !== 'back'),
                    )
                  }
                />
              </div>
              <Form.Item>
                <Button
                  loading={
                    submitRealNameMutation.isPending ||
                    retryRealNameMutation.isPending
                  }
                  type="primary"
                  htmlType="submit"
                >
                  {canRetry ? '重新提交' : '提交实名'}
                </Button>
              </Form.Item>
            </Form>
          ) : null}
        </Space>
      </Modal>
    </>
  );
};

type IdCardSide = 'front' | 'back';

type IdCardMediaRef = {
  media_id: number;
  media_type: 'image';
  side: IdCardSide;
  url?: string;
};

type IdCardMediaPreviewItem = {
  media_id: number;
  media_type?: string;
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

function buildIdCardMediaRef(
  side: IdCardSide,
  media: API.MediaFileOut,
): IdCardMediaRef {
  return {
    media_id: media.id,
    media_type: 'image',
    side,
    url: media.url ?? undefined,
  };
}

function sortIdCardMedia(media: IdCardMediaRef[]) {
  return ['front', 'back']
    .map((side) => media.find((item) => item.side === side))
    .filter(Boolean) as IdCardMediaRef[];
}

function hasBothIdCardSides(media: IdCardMediaRef[]) {
  return (
    media.some((item) => item.side === 'front') &&
    media.some((item) => item.side === 'back')
  );
}

function handleIdCardUpload(
  mutate: (payload: { side: IdCardSide; file: File }) => void,
  side: IdCardSide,
): UploadProps['customRequest'] {
  return (options) => {
    const file = options.file as File;
    mutate({ side, file });
    options.onSuccess?.({} as never);
  };
}

const IdCardUpload: React.FC<{
  label: string;
  uploadedMedia?: IdCardMediaRef;
  loading: boolean;
  onUpload: UploadProps['customRequest'];
  onRemove: () => void;
}> = ({ label, uploadedMedia, loading, onUpload, onRemove }) => {
  const fileList: UploadFile[] = uploadedMedia
    ? [
        {
          uid: String(uploadedMedia.media_id),
          name: label,
          status: 'done',
          url: uploadedMedia.url,
        },
      ]
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
        {fileList.length >= 1 ? null : loading ? (
          <span style={{ color: '#999' }}>上传中...</span>
        ) : (
          <span style={{ fontSize: 12, color: '#999' }}>点击上传</span>
        )}
      </Upload>
    </div>
  );
};

const IdCardPreview: React.FC<{ items: IdCardMediaPreviewItem[] }> = ({
  items,
}) => {
  const front = items.find((item) => item.side === 'front');
  const back = items.find((item) => item.side === 'back');
  const previewItems = [
    front || {
      side: 'front' as IdCardSide,
      url: undefined,
    },
    back || {
      side: 'back' as IdCardSide,
      url: undefined,
    },
  ];

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {previewItems.map((item, index) => {
        const side: IdCardSide =
          item.side === 'front' || item.side === 'back'
            ? item.side
            : index === 0
              ? 'front'
              : 'back';
        const label = getIdCardSideLabel(side);

        return (
          <div
            key={side}
            style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
          >
            <span style={{ fontSize: 14, color: 'rgba(0,0,0,0.88)' }}>
              {label}
            </span>
            <div
              style={{
                width: 104,
                height: 104,
                borderRadius: 8,
                border: '1px solid #d9d9d9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                background: '#fafafa',
              }}
            >
              {item.url ? (
                <Image
                  src={item.url}
                  alt={label}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                  }}
                  preview={{ mask: '查看大图' }}
                />
              ) : (
                <span style={{ color: '#bfbfbf', fontSize: 12 }}>暂无图片</span>
              )}
            </div>
          </div>
        );
      })}
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
  if (
    status === 'verified' ||
    status === 'pending' ||
    status === 'manual_review'
  ) {
    return '查看';
  }
  return '去认证';
}

function buildRealNameDescription(
  realNameStatus?: RealNameStatusRecord,
) {
  if (realNameStatus?.real_name_masked) {
    return `${enumMapping(realNameStatus.status, realNameStatus.status__mapping || realNameStatus.status_label)} · ${realNameStatus.real_name_masked}`;
  }
  return enumMapping(realNameStatus?.status, realNameStatus?.status__mapping || realNameStatus?.status_label) || '未认证';
}

function getRealNameHelper(
  realNameStatus?: RealNameStatusRecord,
): InlineRealNameHelper {
  const status = realNameStatus?.status || 'unverified';
  if (status === 'verified') {
    return {
      type: 'success',
      message: '当前账号已完成实名认证',
      description: realNameStatus?.real_name_masked
        ? `认证姓名：${realNameStatus.real_name_masked}`
        : undefined,
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
      description:
        realNameStatus?.failure_reason ||
        realNameStatus?.review_note ||
        '请耐心等待审核结果。',
    };
  }
  if (isRetryableRealNameStatus(status)) {
    return {
      type: 'error',
      message: '实名认证未通过',
      description:
        realNameStatus?.failure_reason ||
        realNameStatus?.review_note ||
        '请核对信息后重新提交。',
    };
  }
  return {
    type: 'info',
    message: '请完成实名认证',
    description: '实名认证已并入安全设置，提交后会在这里查看结果。',
  };
}

export default RealNameView;
