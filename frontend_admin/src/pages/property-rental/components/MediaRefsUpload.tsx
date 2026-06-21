import { PlusOutlined } from '@ant-design/icons';
import { Button, Select, Space, Upload, message } from 'antd';
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
};

function clean(items: MediaRefValue[]) {
  return stripDerivedMediaFields(items);
}

const MediaRefsUpload: React.FC<Props> = ({ value = [], onChange, resourceType, mediaType, maxCount }) => {
  const [uploading, setUploading] = useState(false);

  const emit = (items: MediaRefValue[]) => onChange?.(clean(items));

  const setRole = (mediaId: number, role: string) => {
    const next = value.map((item) => {
      if (role === 'cover' && item.media_id !== mediaId && item.image_role === 'cover') {
        const { image_role: _imageRole, ...rest } = item;
        return rest;
      }
      return item.media_id === mediaId ? { ...item, image_role: role } : item;
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

  const remove: UploadProps['onRemove'] = (file) => {
    emit(value.filter((item) => String(item.media_id) !== file.uid));
  };

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

  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <Upload
        aria-label="上传文件"
        listType="picture-card"
        fileList={fileList}
        multiple={(maxCount || 2) > 1}
        maxCount={maxCount}
        accept={mediaType === 'image' ? '.jpg,.jpeg,.png,.webp' : undefined}
        customRequest={uploadFile}
        onRemove={remove}
        disabled={uploading}
      >
        {maxCount && value.length >= maxCount ? null : <PlusOutlined />}
      </Upload>
      <Space wrap align="start">
        {value.map((item, index) => {
          const title = item.label || item.original_filename || `#${item.media_id}`;
          return (
            <div key={item.media_id} aria-label={`${title}媒体项`} style={{ width: 180 }}>
              <Space orientation="vertical" size={4}>
                <Select
                  aria-label={`${title}角色`}
                  size="small"
                  value={item.image_role}
                  placeholder="角色"
                  options={HOUSE_IMAGE_ROLE_OPTIONS}
                  onChange={(role) => setRole(item.media_id, role)}
                  style={{ width: 144 }}
                />
                <Space>
                  <Button size="small" onClick={() => setRole(item.media_id, 'cover')}>
                    {item.image_role === 'cover' ? '已是封面' : `将${title}设为封面`}
                  </Button>
                  <Button size="small" disabled={index === 0} onClick={() => move(index, index - 1)}>
                    {`上移${title}`}
                  </Button>
                  <Button size="small" disabled={index === value.length - 1} onClick={() => move(index, index + 1)}>
                    {`下移${title}`}
                  </Button>
                </Space>
                <Space wrap>
                  {HOUSE_IMAGE_ROLE_OPTIONS.filter((role) => role.value !== 'cover').map((role) => (
                    <Button key={role.value} size="small" onClick={() => setRole(item.media_id, role.value)}>
                      {`设为${role.label}`}
                    </Button>
                  ))}
                </Space>
              </Space>
            </div>
          );
        })}
      </Space>
    </Space>
  );
};

export default MediaRefsUpload;
