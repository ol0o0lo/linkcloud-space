import { CheckCircleOutlined, RightOutlined } from '@ant-design/icons';
import { history } from '@umijs/max';
import { Button, Space, Tag } from 'antd';
import type { HouseOut } from '@/services/manual/house';
import { WorkbenchWidgetFrame } from '../../components/WorkbenchWidgetFrame';
import { useMineWorkbenchData } from '../../data/MineWorkbenchData';
import type { WorkbenchWidgetWidth } from '../../layout/model';
import { useStyles } from '../../styles';

function InspectionReasons({ house }: { house: HouseOut }) {
  return (
    <Space size={[4, 4]} wrap>
      {(house.inspection_reasons || []).map((reason) => {
        if (reason === 'missing_images') {
          return (
            <Tag key={reason} color="warning">
              缺照片
            </Tag>
          );
        }
        if (reason === 'missing_videos') {
          return (
            <Tag key={reason} color="warning">
              缺视频
            </Tag>
          );
        }
        return (
          <Tag key={reason} color="error">
            资料过期
          </Tag>
        );
      })}
    </Space>
  );
}

function houseLabel(house: HouseOut) {
  const estate = house.building?.estate;
  const estateName = estate?.display_name || estate?.name;
  return [estateName, house.building?.name, house.room_number]
    .filter(Boolean)
    .join(' · ');
}

export function HouseInspectionWidget({
  width: _width,
}: {
  width: WorkbenchWidgetWidth;
}) {
  const { styles } = useStyles();
  const {
    inspectionHouses,
    inspectionTotal,
    inspectionLoading,
    inspectionError,
    retryInspection,
  } = useMineWorkbenchData();

  return (
    <WorkbenchWidgetFrame
      variant="inspection"
      title="待勘察房源"
      subtitle={`当前有 ${inspectionTotal} 套负责房源需要补充或核对资料`}
      extra={
        <Button
          type="link"
          onClick={() =>
            history.push(
              '/rental/properties/list?scope=mine&inspection_due=true',
            )
          }
        >
          查看全部
        </Button>
      }
      loading={inspectionLoading}
      error={inspectionError}
      onRetry={retryInspection}
    >
      {inspectionHouses.length ? (
        <div
          className={styles.inspectionHouseList}
          data-testid="mine-inspection-list"
        >
          {inspectionHouses.map((house) => (
            <button
              key={house.id}
              type="button"
              className={styles.inspectionHouseItem}
              onClick={() =>
                history.push(`/rental/properties/${house.id}?action=edit`)
              }
            >
              <span className={styles.inspectionHouseCopy}>
                <strong>{houseLabel(house)}</strong>
                <InspectionReasons house={house} />
              </span>
              <RightOutlined aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.widgetCompactEmpty}>
          <span
            className={styles.widgetCompactEmptyIcon}
            data-tone="success"
            aria-hidden="true"
          >
            <CheckCircleOutlined />
          </span>
          <span className={styles.widgetCompactEmptyCopy}>
            <strong>当前负责房源均无需勘察</strong>
            <small>资料缺失或超过有效期的房源会显示在这里</small>
          </span>
        </div>
      )}
    </WorkbenchWidgetFrame>
  );
}
