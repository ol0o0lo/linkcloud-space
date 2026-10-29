import { describe, expect, it, vi } from 'vitest';

const { patchHouse, patchBuilding } = vi.hoisted(() => ({ patchHouse: vi.fn(), patchBuilding: vi.fn() }));
vi.mock('@umijs/max', () => ({ request: vi.fn() }));
vi.mock('@/services/openapi/propertyRentalManagement', () => ({ appsHouseApiPropertiesPatchHouse: patchHouse, appsHouseApiPropertiesPatchBuilding: patchBuilding }));
import { houseApi } from './house';

describe('迁移媒体写入边界', () => {
  it('编辑房源时仅保留正式媒体，移除只读迁移附加字段', async () => {
    const values = { room_number: '201', images: [{ media_id: 12, media_type: 'image' }], migration_media: [{ id: 'pending', url: 'https://old.example/file.jpg' }] };
    await houseApi.patchHouse(8, values);
    expect(patchHouse).toHaveBeenCalledWith({ house_id: 8 }, { room_number: '201', images: [{ media_id: 12, media_type: 'image' }] });
    expect(values.migration_media).toHaveLength(1);
  });

  it('楼栋编辑同样不回传迁移媒体附加字段', async () => {
    await houseApi.patchBuilding(9, { name: '楼栋', migration_media: [{ id: 'pending' }] });
    expect(patchBuilding).toHaveBeenCalledWith({ building_id: 9 }, { name: '楼栋' });
  });
});
