import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));
vi.mock('@umijs/max', () => ({ request: mockRequest }));
import { dataMigrationApi } from './dataMigration';

describe('数据迁移请求', () => {
  beforeEach(() => mockRequest.mockReset());

  it('上传 ZIP 并显式绑定目标组织，保留 multipart 边界', async () => {
    const file = new File(['zip'], 'team.zip', { type: 'application/zip' });
    await dataMigrationApi.upload('target', file);
    const [url, options] = mockRequest.mock.calls[0];
    expect(url).toBe('/api/data-migration/batches/');
    expect(options.headers).toEqual({ 'X-Org-Slug': 'target' });
    expect(options.data.get('file')).toBe(file);
    expect(options.method).toBe('POST');
  });

  it('确认必须发送正在核对的预检版本', async () => {
    await dataMigrationApi.confirm('target', 'batch-1', 'version-2');
    expect(mockRequest).toHaveBeenCalledWith('/api/data-migration/batches/batch-1/confirm/', expect.objectContaining({ data: { preview_version: 'version-2' }, headers: { 'X-Org-Slug': 'target' } }));
  });

  it('档案查询保留分页与分类条件', async () => {
    const filters = { page: 2, page_size: 20, entity_type: 'bills', search: '旧单号', batch_id: 'batch-1', created_from: '2026-01-01', created_to: '2026-10-25', staff_id: '7', checked: true, approved: false, source_deleted: false, bill_number: 'B-2' };
    await dataMigrationApi.archives('target', filters);
    expect(mockRequest).toHaveBeenCalledWith('/api/data-migration/archives/', expect.objectContaining({ params: filters }));
  });

  it('资源修正与补传使用独立资源重试接口', async () => {
    await dataMigrationApi.retryAsset('target', 'asset-1', { media_id: 42 });
    expect(mockRequest).toHaveBeenCalledWith('/api/data-migration/assets/asset-1/retry/', expect.objectContaining({ method: 'POST', data: { media_id: 42 } }));
  });
});
