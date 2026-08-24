import { InputNumber, Modal, Space, Typography } from 'antd';
import MediaRefsUpload from '../components/MediaRefsUpload';
import { normalizePropertyTags } from '../components/PropertyTagSelect';
import {
  HOUSE_MEDIA_RESOURCE_TYPE,
  HOUSE_MEDIA_TYPE,
  type MediaRefValue,
  stripDerivedMediaFields,
} from '../constants';

export type HouseMediaEditValue = {
  images: MediaRefValue[];
  videos: MediaRefValue[];
};

export type HouseRoomLayoutEditValue = {
  bedrooms?: number | null;
  living_rooms?: number | null;
};

export type HouseInlineEditableFields = {
  room_layout_edit?: HouseRoomLayoutEditValue;
  media_edit?: HouseMediaEditValue;
};

type RoomLayoutEditorProps = {
  value?: HouseRoomLayoutEditValue;
  onChange?: (value: HouseRoomLayoutEditValue) => void;
};

type MediaEditorModalProps = {
  open: boolean;
  value?: HouseMediaEditValue;
  onChange?: (value: HouseMediaEditValue) => void;
  onClose?: () => void;
};

const numericValue = (value: number | null | undefined) =>
  value === null || value === undefined ? null : Number(value);

export function HouseRoomLayoutInlineEditor({
  value = {},
  onChange,
}: RoomLayoutEditorProps) {
  return (
    <Space.Compact block style={{ width: 184 }}>
      <InputNumber
        aria-label="卧室"
        min={0}
        placeholder="房"
        suffix="房"
        value={numericValue(value.bedrooms)}
        onChange={(bedrooms) => onChange?.({ ...value, bedrooms })}
      />
      <InputNumber
        aria-label="客厅"
        min={0}
        placeholder="厅"
        suffix="厅"
        value={numericValue(value.living_rooms)}
        onChange={(living_rooms) => onChange?.({ ...value, living_rooms })}
      />
    </Space.Compact>
  );
}

export function HouseMediaInlineEditorModal({
  open,
  value = { images: [], videos: [] },
  onChange,
  onClose,
}: MediaEditorModalProps) {
  return (
    <Modal
      title="编辑图片视频"
      open={open}
      width={920}
      okText="完成"
      cancelButtonProps={{ style: { display: 'none' } }}
      destroyOnHidden
      onCancel={onClose}
      onOk={onClose}
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Typography.Text type="secondary">
          此处调整先保存在当前编辑行中，点击表格行末“保存”后才写入房源。
        </Typography.Text>
        <MediaRefsUpload
          title="图片资料"
          value={value.images}
          resourceType={HOUSE_MEDIA_RESOURCE_TYPE.HOUSE_IMAGE}
          mediaType={HOUSE_MEDIA_TYPE.IMAGE}
          maxCount={9}
          preserveDerivedFieldsOnChange
          onChange={(images) =>
            onChange?.({
              ...value,
              images: images as MediaRefValue[],
            })
          }
        />
        <MediaRefsUpload
          title="视频资料"
          value={value.videos}
          resourceType={HOUSE_MEDIA_RESOURCE_TYPE.HOUSE_VIDEO}
          mediaType={HOUSE_MEDIA_TYPE.VIDEO}
          maxCount={3}
          preserveDerivedFieldsOnChange
          onChange={(videos) =>
            onChange?.({
              ...value,
              videos: videos as MediaRefValue[],
            })
          }
        />
      </Space>
    </Modal>
  );
}

function zeroIfEmpty(value: unknown) {
  return value === '' || value === null || value === undefined ? 0 : value;
}

function nullIfEmpty(value: unknown) {
  return value === '' || value === undefined ? null : value;
}

export function buildHouseInlinePatch(
  record: Record<string, unknown> & HouseInlineEditableFields,
) {
  const roomLayout = record.room_layout_edit;
  const media = record.media_edit || { images: [], videos: [] };
  return {
    building_id: record.building_id,
    landlord_id: nullIfEmpty(record.landlord_id),
    room_number: record.room_number,
    floor: zeroIfEmpty(record.floor),
    area: zeroIfEmpty(record.area),
    interior_area: zeroIfEmpty(record.interior_area),
    asking_rent: zeroIfEmpty(record.asking_rent),
    deposit_amount: zeroIfEmpty(record.deposit_amount),
    bedrooms: zeroIfEmpty(roomLayout ? roomLayout.bedrooms : record.bedrooms),
    living_rooms: zeroIfEmpty(
      roomLayout ? roomLayout.living_rooms : record.living_rooms,
    ),
    bathrooms: zeroIfEmpty(record.bathrooms),
    kitchens: zeroIfEmpty(record.kitchens),
    balconies: zeroIfEmpty(record.balconies),
    orientation: nullIfEmpty(record.orientation),
    decoration: nullIfEmpty(record.decoration),
    status: record.status,
    images: stripDerivedMediaFields(media.images),
    videos: stripDerivedMediaFields(media.videos),
    tags: normalizePropertyTags(record.tags as unknown[] | undefined),
    public_description: record.public_description || '',
    internal_notes: record.internal_notes || '',
  };
}
