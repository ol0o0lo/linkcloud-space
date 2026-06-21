import { DeleteOutlined } from '@ant-design/icons';
import { Button, Image, Select, Space, message } from 'antd';
import React, { useRef, useState } from 'react';
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
  const dragIndex = useRef<number | null>(null);

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

  const remove = (mediaId: number) => emit(value.filter((item) => item.media_id !== mediaId));

  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    emit(next);
  };

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = await appsMediaApiUploadFiles({ resource_type: resourceType, scope: 'org' }, files);
      const refs = uploaded.map((item, index) => ({
        media_id: item.id,
        media_type: mediaType,
        label: item.original_filename || files[index]?.name,
        url: item.url,
      }));
      emit([...(value || []), ...refs]);
    } catch (_error) {
      message.error('上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <input
        aria-label="选择文件"
        type="file"
        multiple={(maxCount || 2) > 1}
        accept={mediaType === 'image' ? '.jpg,.jpeg,.png,.webp' : undefined}
        disabled={uploading}
        onChange={(event) => uploadFiles(Array.from(event.target.files || []))}
      />
      <Space wrap>
        {value.map((item, index) => {
          const title = item.label || item.original_filename || `#${item.media_id}`;
          return (
            <div
              key={item.media_id}
              aria-label={`${title}媒体项`}
              draggable
              onDragStart={() => {
                dragIndex.current = index;
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragIndex.current !== null) move(dragIndex.current, index);
                dragIndex.current = null;
              }}
              style={{ width: 160 }}
            >
              {mediaType === 'image' && item.url ? <Image width={144} height={96} style={{ objectFit: 'cover' }} src={item.url} alt={title} /> : <div>{title}</div>}
              <Space direction="vertical" size={4}>
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
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(item.media_id)}>
                    删除
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
