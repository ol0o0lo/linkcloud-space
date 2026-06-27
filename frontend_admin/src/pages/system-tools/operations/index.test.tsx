import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemOperationsPage from './index';

const {
  mockVersion,
  mockStaffUsers,
  mockSendNotification,
  mockOssToken,
  mockUploadFiles,
  mockConfirmUpload,
} = vi.hoisted(() => ({
  mockVersion: vi.fn(),
  mockStaffUsers: vi.fn(),
  mockSendNotification: vi.fn(),
  mockOssToken: vi.fn(),
  mockUploadFiles: vi.fn(),
  mockConfirmUpload: vi.fn(),
}));

vi.mock('@/services/openapi/appSystem', () => ({
  appsBaseApiGetVersion: mockVersion,
  appsBaseApiTestNotificationsStaffUsers: mockStaffUsers,
  appsBaseApiSendTestNotification: mockSendNotification,
}));

vi.mock('@/services/openapi/mediaFiles', () => ({
  appsMediaApiOssToken: mockOssToken,
  appsMediaApiUploadFiles: mockUploadFiles,
  appsMediaApiConfirmUpload: mockConfirmUpload,
}));

describe('SystemOperationsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockVersion.mockResolvedValue({ version: '2026.06.16' });
    mockStaffUsers.mockResolvedValue([{ id: 7, username: 'alice', email: 'alice@example.com' }]);
    mockSendNotification.mockResolvedValue({});
    mockOssToken.mockResolvedValue({ path: 'uploads/avatar/a.png', bucket: 'media' });
    mockUploadFiles.mockResolvedValue([{ id: 2, original_filename: 'b.png', resource_type: 'avatar', url: '/media/b.png', file_size: 12, created_at: '2026-06-16T10:00:00+08:00' }]);
    mockConfirmUpload.mockResolvedValue({ id: 1, original_filename: 'a.png', resource_type: 'avatar', url: '/media/a.png', file_size: 10, created_at: '2026-06-16T10:00:00+08:00' });
  });

  it('loads system metadata and triggers notification / media actions', async () => {
    render(<QueryClientProvider client={queryClient}><SystemOperationsPage /></QueryClientProvider>);

    await waitFor(() => {
      expect(mockVersion).toHaveBeenCalled();
      expect(mockStaffUsers).toHaveBeenCalled();
      expect(screen.getAllByText('2026.06.16').length).toBeGreaterThan(0);
    });

    expect(screen.queryByText('当前风险')).not.toBeInTheDocument();
    expect(screen.queryByText('常用演练模板')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '房源图片直传' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('测试通知用户 ID'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: '发送测试通知' }));
    await waitFor(() => expect(mockSendNotification).toHaveBeenCalledWith({ user_id: 7, send_email: true, send_in_app: true }));

    fireEvent.change(screen.getByLabelText('资源类型'), { target: { value: 'avatar' } });
    fireEvent.change(screen.getByLabelText('文件名'), { target: { value: 'a.png' } });
    fireEvent.change(screen.getByLabelText('上传凭证作用域'), { target: { value: 'user' } });
    fireEvent.click(screen.getByRole('button', { name: '获取上传凭证' }));
    await waitFor(() => expect(mockOssToken).toHaveBeenCalledWith({ resource_type: 'avatar', filename: 'a.png', scope: 'user' }));
    expect(await screen.findByText('最近凭证结果')).toBeInTheDocument();
    expect(screen.getByText('uploads/avatar/a.png')).toBeInTheDocument();

    const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const uploadFile = new File(['avatar'], 'b.png', { type: 'image/png' });
    fireEvent.change(uploadInput, { target: { files: [uploadFile] } });
    fireEvent.change(screen.getByLabelText('服务端上传资源类型'), { target: { value: 'avatar' } });
    fireEvent.change(screen.getByLabelText('服务端上传作用域'), { target: { value: 'user' } });
    fireEvent.click(screen.getByRole('button', { name: '服务端上传' }));
    await waitFor(() => expect(mockUploadFiles).toHaveBeenCalledWith({ resource_type: 'avatar', scope: 'user' }, [uploadFile]));
    expect(await screen.findByText('最近服务端上传结果')).toBeInTheDocument();
    expect(screen.getAllByText('b.png').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('OSS 路径'), { target: { value: 'uploads/avatar/a.png' } });
    fireEvent.change(screen.getByLabelText('原始文件名'), { target: { value: 'a.png' } });
    fireEvent.change(screen.getByLabelText('登记资源类型'), { target: { value: 'avatar' } });
    fireEvent.change(screen.getByLabelText('文件大小'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: '登记媒体文件' }));
    await waitFor(() => expect(mockConfirmUpload).toHaveBeenCalledWith({ oss_path: 'uploads/avatar/a.png', original_filename: 'a.png', resource_type: 'avatar', file_size: 10 }));
    expect(await screen.findByText('最近媒体登记结果')).toBeInTheDocument();
  });
});
