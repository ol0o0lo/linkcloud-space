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
import { Button, Empty, Select, Space, Tag, Tooltip, Typography, Upload, message, theme } from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import React, { useState } from 'react';
import { appsMediaApiUploadFiles } from '@/services/openapi/mediaFiles';
import { HOUSE_IMAGE_ROLE_OPTIONS, type MediaRefValue, stripDerivedMediaFields } from '../constants';

type CleanMediaRefValue = ReturnType<typeof stripDerivedMediaFields>;

type Props = {
  value?: MediaRefValue[];
  onChange?: (value: CleanMediaRefValue) => void;
  resourceType: string;
  mediaType: 'image' | 'video' | 'file';
  maxCount?: number;
  title?: string;
};

function clean(items: MediaRefValue[]) {
  return stripDerivedMediaFields(items);
}

const MEDIA_COPY = {
  image: {
    uploadLabel: '上传图片',
    emptyText: '暂无图片素材',
    summaryLabel: '图片',
    accept: '.jpg,.jpeg,.png,.webp',
    icon: <PictureOutlined />,
  },
  video: {
    uploadLabel: '上传视频',
    emptyText: '暂无视频素材',
    summaryLabel: '视频',
    accept: '.mp4,.mov,.m4v,.webm',
    icon: <VideoCameraOutlined />,
  },
  file: {
    uploadLabel: '上传文件',
    emptyText: '暂无文件',
    summaryLabel: '文件',
    accept: undefined,
    icon: <FileOutlined />,
  },
} as const;

const MediaRefsUpload: React.FC<Props> = ({ value = [], onChange, resourceType, mediaType, maxCount, title }) => {
  const { token } = theme.useToken();
  const [uploading, setUploading] = useState(false);
  const canSetImageRole = mediaType === 'image';
  const imageRoleOptions = HOUSE_IMAGE_ROLE_OPTIONS.filter((role) => role.value !== 'cover');
  const imageRoleLabelMap = new Map(HOUSE_IMAGE_ROLE_OPTIONS.map((role) => [role.value, role.label]));
  const copy = MEDIA_COPY[mediaType];
  const imageCount = value.length;
  const hasCover = value.some((item) => item.image_role === 'cover');
  const hasFloorPlan = value.some((item) => item.image_role === 'floor_plan');
  const isMaxed = Boolean(maxCount && value.length >= maxCount);

  const emit = (items: MediaRefValue[]) => onChange?.(clean(items));

  const setRole = (mediaId: number, role?: string) => {
    const next = value.map((item) => {
      if (role === 'cover' && item.media_id !== mediaId && item.image_role === 'cover') {
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

  const fileList: UploadFile[] = value.map((item) => ({
    uid: String(item.media_id),
    name: item.label || item.original_filename || `#${item.media_id}`,
    status: 'done',
    url: item.url,
    thumbUrl: item.thumbnail || item.url,
  }));

  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    emit(next);
  };

  const uploadFile: UploadProps['customRequest'] = async ({ file, onSuccess, onError }) => {
    setUploading(true);
    try {
      const files = [file as File];
      const uploaded = await appsMediaApiUploadFiles({ resource_type: resourceType, scope: 'org' }, files);
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

  const renderMediaTags = (item: MediaRefValue) => {
    if (mediaType !== 'image') {
      return <Tag style={{ marginInlineEnd: 0 }}>{copy.summaryLabel}</Tag>;
    }
    if (item.image_role === 'cover') {
      return (
        <Space size={[4, 4]} wrap>
          <Tag color="gold" style={{ marginInlineEnd: 0 }}>
            封面
          </Tag>
        </Space>
      );
    }
    const imageRoleLabel = item.image_role ? imageRoleLabelMap.get(item.image_role) : undefined;
    return (
      <Tag icon={<PictureOutlined />} style={{ marginInlineEnd: 0 }}>
        {imageRoleLabel || '未分类'}
      </Tag>
    );
  };

  const renderSummary = () => (
    <Space wrap size={[8, 8]}>
      <Tag color="blue">{`${copy.summaryLabel} ${value.length}${mediaType === 'image' ? ' 张' : mediaType === 'video' ? ' 个' : ' 份'}`}</Tag>
      {mediaType === 'image' ? (
        <>
          <Tag color={hasCover ? 'gold' : 'orange'}>{hasCover ? '封面已配置' : '待补封面'}</Tag>
          <Tag color={hasFloorPlan ? 'green' : 'orange'}>{hasFloorPlan ? '户型图已配置' : '待补户型图'}</Tag>
          <Tag>{`${imageCount} 张素材`}</Tag>
        </>
      ) : null}
      {maxCount ? <Tag>{`上限 ${maxCount}`}</Tag> : null}
    </Space>
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
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusLG,
          padding: 16,
          background: token.colorBgContainer,
        }}
      >
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Space wrap align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
            {renderSummary()}
            {!isMaxed ? (
              <Upload
                aria-label={copy.uploadLabel}
                showUploadList={false}
                fileList={fileList}
                multiple={(maxCount || 2) > 1}
                maxCount={maxCount}
                accept={copy.accept}
                customRequest={uploadFile}
                disabled={uploading}
              >
                <Button icon={<PlusOutlined />} loading={uploading}>
                  {copy.uploadLabel}
                </Button>
              </Upload>
            ) : null}
          </Space>

          {!value.length ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={copy.emptyText}
            />
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: mediaType === 'image' ? 'repeat(auto-fit, minmax(240px, 1fr))' : 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 12,
              }}
            >
              {value.map((item, index) => {
                const itemTitle = item.label || item.original_filename || `#${item.media_id}`;
                return (
                  <div
                    key={item.media_id}
                    style={{
                      border: `1px solid ${token.colorBorderSecondary}`,
                      borderRadius: token.borderRadius,
                      overflow: 'hidden',
                      background: token.colorFillQuaternary,
                    }}
                  >
                    {mediaType === 'image' ? (
                      <div
                        style={{
                          height: 144,
                          background: token.colorFillAlter,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {item.url ? (
                          <img
                            src={item.thumbnail || item.url}
                            alt={itemTitle}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        ) : (
                          <PictureOutlined style={{ fontSize: 28, color: token.colorTextTertiary }} />
                        )}
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: '20px 16px 0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          color: token.colorTextSecondary,
                        }}
                      >
                        {copy.icon}
                        <Typography.Text type="secondary">{copy.summaryLabel}</Typography.Text>
                      </div>
                    )}
                    <Space orientation="vertical" size={12} style={{ width: '100%', padding: 16 }}>
                      <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Tooltip title={itemTitle}>
                          <Typography.Text ellipsis style={{ maxWidth: 160 }}>
                            {itemTitle}
                          </Typography.Text>
                        </Tooltip>
                        {renderMediaTags(item)}
                      </Space>

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

                      <Space size={4} wrap>
                        {canSetImageRole ? (
                          <Tooltip title={item.image_role === 'cover' ? '已设为封面' : '设为封面'}>
                            <Button
                              aria-label={item.image_role === 'cover' ? `${itemTitle}已是封面` : `将${itemTitle}设为封面`}
                              icon={item.image_role === 'cover' ? <StarFilled /> : <StarOutlined />}
                              size="small"
                              type={item.image_role === 'cover' ? 'primary' : 'default'}
                              onClick={() => setRole(item.media_id, 'cover')}
                            />
                          </Tooltip>
                        ) : null}
                        {item.url ? (
                          <Tooltip title="查看原文件">
                            <Button
                              aria-label={`查看${itemTitle}`}
                              href={item.url}
                              icon={<EyeOutlined />}
                              size="small"
                              target="_blank"
                            />
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
                    </Space>
                  </div>
                );
              })}
            </div>
          )}
        </Space>
      </div>
    </Space>
  );
};

export default MediaRefsUpload;
