import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileOutlined,
  PictureOutlined,
  PlusOutlined,
  StarFilled,
  StarOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import {
  Button,
  Image,
  Modal,
  message,
  Select,
  Space,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import React, { useState } from 'react';
import { appsMediaApiUploadFiles } from '@/services/openapi/mediaFiles';
import {
  HOUSE_IMAGE_ROLE_OPTIONS,
  type MediaRefValue,
  stripDerivedMediaFields,
} from '../constants';

type CleanMediaRefValue = ReturnType<typeof stripDerivedMediaFields>;

type Props = {
  value?: MediaRefValue[];
  onChange?: (value: MediaRefValue[] | CleanMediaRefValue) => void;
  resourceType: string;
  mediaType: 'image' | 'video' | 'file';
  maxCount?: number;
  title?: string;
  enableImageRoles?: boolean;
  preserveDerivedFieldsOnChange?: boolean;
};

function clean(items: MediaRefValue[]) {
  return stripDerivedMediaFields(items);
}

const MEDIA_COPY = {
  image: {
    uploadLabel: '上传图片',
    accept: '.jpg,.jpeg,.png,.webp',
    icon: <PictureOutlined />,
  },
  video: {
    uploadLabel: '上传视频',
    accept: '.mp4,.mov,.m4v,.webm',
    icon: <VideoCameraOutlined />,
  },
  file: {
    uploadLabel: '上传文件',
    accept: undefined,
    icon: <FileOutlined />,
  },
} as const;

const CARD_SIZE = 164;

const MediaRefsUpload: React.FC<Props> = ({
  value = [],
  onChange,
  resourceType,
  mediaType,
  maxCount,
  title,
  enableImageRoles = true,
  preserveDerivedFieldsOnChange = false,
}) => {
  const [uploading, setUploading] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<{
    title: string;
    url: string;
  }>();
  const canSetImageRole = mediaType === 'image' && enableImageRoles;
  const imageRoleOptions = HOUSE_IMAGE_ROLE_OPTIONS.filter(
    (role) => role.value !== 'cover',
  );
  const copy = MEDIA_COPY[mediaType];
  const isMaxed = Boolean(maxCount && value.length >= maxCount);

  const emit = (items: MediaRefValue[]) =>
    onChange?.(preserveDerivedFieldsOnChange ? items : clean(items));

  const setRole = (mediaId: number, role?: string) => {
    const next = value.map((item) => {
      if (
        role === 'cover' &&
        item.media_id !== mediaId &&
        item.image_role === 'cover'
      ) {
        const { image_role: _imageRole, ...rest } = item;
        return rest;
      }
      if (item.media_id !== mediaId) {
        return item;
      }
      if (!role) {
        const { image_role: _imageRole, ...rest } = item;
        return rest;
      }
      return { ...item, image_role: role };
    });
    emit(next);
  };

  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    emit(next);
  };

  const uploadFile: UploadProps['customRequest'] = async ({
    file,
    onSuccess,
    onError,
  }) => {
    setUploading(true);
    try {
      const files = [file as File];
      const uploaded = await appsMediaApiUploadFiles(
        { resource_type: resourceType, scope: 'org' },
        files,
      );
      const refs = uploaded.map((item, index) => ({
        media_id: item.id,
        media_type: mediaType,
        label: item.original_filename || files[index]?.name,
        url: item.url,
      }));
      emit([...(value || []), ...refs]);
      onSuccess?.(uploaded[0]);
    } catch (_error) {
      message.error('上传失败，请重试');
      onError?.(_error as Error);
    } finally {
      setUploading(false);
    }
  };

  const removeByMediaId = (mediaId: number) => {
    emit(value.filter((item) => item.media_id !== mediaId));
  };

  const openVideoPreview = (item: MediaRefValue, itemTitle: string) => {
    if (item.url) {
      setPreviewVideo({ title: itemTitle, url: item.url });
    }
  };

  const renderActions = (
    item: MediaRefValue,
    index: number,
    itemTitle: string,
  ) => (
    <Space
      size={4}
      wrap
      onClick={(event) => event.stopPropagation()}
      style={{ justifyContent: 'center' }}
    >
      {canSetImageRole ? (
        <Tooltip
          title={item.image_role === 'cover' ? '已设为首图' : '设为首图'}
        >
          <Button
            aria-label={
              item.image_role === 'cover'
                ? `${itemTitle}已是首图`
                : `将${itemTitle}设为首图`
            }
            icon={
              item.image_role === 'cover' ? <StarFilled /> : <StarOutlined />
            }
            size="small"
            type={item.image_role === 'cover' ? 'primary' : 'default'}
            onClick={() => setRole(item.media_id, 'cover')}
          />
        </Tooltip>
      ) : null}
      {item.url ? (
        <Tooltip title="预览">
          {mediaType === 'video' ? (
            <Button
              aria-label={`预览${itemTitle}`}
              icon={<EyeOutlined />}
              size="small"
              onClick={() => openVideoPreview(item, itemTitle)}
            />
          ) : (
            <Button
              aria-label={`预览${itemTitle}`}
              href={item.url}
              icon={<EyeOutlined />}
              size="small"
              target="_blank"
            />
          )}
        </Tooltip>
      ) : null}
      <Tooltip title="上移">
        <Button
          aria-label={`上移${itemTitle}`}
          icon={<ArrowLeftOutlined />}
          size="small"
          disabled={index === 0}
          onClick={() => move(index, index - 1)}
        />
      </Tooltip>
      <Tooltip title="下移">
        <Button
          aria-label={`下移${itemTitle}`}
          icon={<ArrowRightOutlined />}
          size="small"
          disabled={index === value.length - 1}
          onClick={() => move(index, index + 1)}
        />
      </Tooltip>
      <Tooltip title="移除">
        <Button
          danger
          aria-label={`移除${itemTitle}`}
          icon={<DeleteOutlined />}
          size="small"
          onClick={() => removeByMediaId(item.media_id)}
        />
      </Tooltip>
    </Space>
  );

  const renderPreview = (item: MediaRefValue, itemTitle: string) => {
    if (mediaType === 'image' && item.url) {
      return (
        <Image
          alt={itemTitle}
          src={item.thumbnail || item.url}
          preview={{ src: item.url }}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      );
    }
    if (mediaType === 'video' && item.url) {
      return (
        <button
          aria-label={`打开${itemTitle}预览`}
          type="button"
          onClick={() => openVideoPreview(item, itemTitle)}
          style={{
            width: '100%',
            height: '100%',
            padding: 0,
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          <video
            muted
            preload="metadata"
            src={item.url}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </button>
      );
    }
    return <span style={{ fontSize: 32 }}>{copy.icon}</span>;
  };

  const renderMediaCard = (item: MediaRefValue, index: number) => {
    const itemTitle =
      item.label || item.original_filename || `#${item.media_id}`;

    return (
      <Space
        key={item.media_id}
        orientation="vertical"
        size={4}
        style={{ width: CARD_SIZE }}
      >
        <div
          style={{
            width: CARD_SIZE,
            height: CARD_SIZE,
            border: '1px solid var(--ant-color-border)',
            borderRadius: 8,
            overflow: 'hidden',
            background: 'var(--ant-color-fill-quaternary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {renderPreview(item, itemTitle)}
        </div>
        {canSetImageRole ? (
          <Select
            aria-label={`${itemTitle}角色`}
            allowClear
            size="small"
            value={item.image_role === 'cover' ? undefined : item.image_role}
            placeholder="房间角色"
            options={imageRoleOptions}
            onChange={(role) => setRole(item.media_id, role)}
            style={{ width: '100%' }}
          />
        ) : null}
        {renderActions(item, index, itemTitle)}
      </Space>
    );
  };

  const renderUploadButton = () => (
    <Upload
      aria-label={copy.uploadLabel}
      showUploadList={false}
      multiple={(maxCount || 2) > 1}
      maxCount={maxCount}
      accept={copy.accept}
      customRequest={uploadFile}
      disabled={uploading}
    >
      <button
        type="button"
        style={{
          width: CARD_SIZE,
          height: CARD_SIZE,
          border: '1px dashed var(--ant-color-border)',
          borderRadius: 8,
          background: 'var(--ant-color-fill-quaternary)',
          cursor: uploading ? 'default' : 'pointer',
          fontSize: 16,
        }}
      >
        <PlusOutlined />
        <div style={{ marginTop: 8 }}>{copy.uploadLabel}</div>
      </button>
    </Upload>
  );

  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      {title ? (
        <Space orientation="vertical" size={4} style={{ width: '100%' }}>
          <Typography.Text strong>{title}</Typography.Text>
        </Space>
      ) : null}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, ${CARD_SIZE}px)`,
          gap: 16,
          alignItems: 'start',
        }}
      >
        {value.map(renderMediaCard)}
        {!isMaxed ? renderUploadButton() : null}
      </div>
      <Modal
        centered
        destroyOnHidden
        footer={null}
        open={Boolean(previewVideo)}
        title={previewVideo?.title}
        width={480}
        onCancel={() => setPreviewVideo(undefined)}
      >
        {previewVideo ? (
          <video
            controls
            src={previewVideo.url}
            style={{
              display: 'block',
              width: '100%',
              maxHeight: '64vh',
              objectFit: 'contain',
            }}
          >
            <track kind="captions" />
          </video>
        ) : null}
      </Modal>
    </Space>
  );
};

export default MediaRefsUpload;
