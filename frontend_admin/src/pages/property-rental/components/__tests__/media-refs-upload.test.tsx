import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MediaRefsUpload from '../MediaRefsUpload';

const { mockUploadFiles } = vi.hoisted(() => ({ mockUploadFiles: vi.fn() }));

vi.mock('@/services/openapi/mediaFiles', () => ({
  appsMediaApiUploadFiles: mockUploadFiles,
}));

describe('MediaRefsUpload', () => {
  beforeEach(() => {
    mockUploadFiles.mockReset();
  });

  it('strips derived fields from value changes', () => {
    const onChange = vi.fn();
    render(
      <MediaRefsUpload
        mediaType="image"
        resourceType="house_image"
        value={[{ media_id: 1, media_type: 'image', label: '客厅', image_role: 'cover', url: '/stale.png', file_size: 10 }]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '设为卧室' }));

    expect(onChange).toHaveBeenCalledWith([{ media_id: 1, media_type: 'image', label: '客厅', image_role: 'bedroom' }]);
  });

  it('keeps one cover when setting cover', () => {
    const onChange = vi.fn();
    render(
      <MediaRefsUpload
        mediaType="image"
        resourceType="house_image"
        value={[
          { media_id: 1, media_type: 'image', label: '客厅', image_role: 'cover' },
          { media_id: 2, media_type: 'image', label: '卧室', image_role: 'bedroom' },
        ]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '将卧室设为封面' }));

    expect(onChange).toHaveBeenCalledWith([
      { media_id: 1, media_type: 'image', label: '客厅' },
      { media_id: 2, media_type: 'image', label: '卧室', image_role: 'cover' },
    ]);
  });

  it('uploads selected files and appends media refs', async () => {
    mockUploadFiles.mockResolvedValue([{ id: 3, original_filename: 'kitchen.png', url: '/kitchen.png' }]);
    const onChange = vi.fn();
    const { container } = render(<MediaRefsUpload mediaType="image" resourceType="house_image" value={[]} onChange={onChange} />);

    const file = new File(['x'], 'kitchen.png', { type: 'image/png' });
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } });

    await waitFor(() => expect(mockUploadFiles).toHaveBeenCalledWith({ resource_type: 'house_image', scope: 'org' }, [file]));
    expect(onChange).toHaveBeenCalledWith([{ media_id: 3, media_type: 'image', label: 'kitchen.png' }]);
  });

  it('uses picture-card list and hides upload button at max count', () => {
    render(
      <MediaRefsUpload
        mediaType="image"
        resourceType="house_image"
        maxCount={1}
        value={[{ media_id: 1, media_type: 'image', label: '客厅', url: '/living.png' }]}
      />,
    );

    expect(document.querySelector('.ant-upload-list-picture-card')).toBeInTheDocument();
    expect(document.querySelector('.ant-upload-select')).toHaveClass('ant-upload-hidden');
  });

  it('reorders items with move buttons', () => {
    const onChange = vi.fn();
    render(
      <MediaRefsUpload
        mediaType="image"
        resourceType="house_image"
        value={[
          { media_id: 1, media_type: 'image', label: '客厅' },
          { media_id: 2, media_type: 'image', label: '卧室' },
        ]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '上移卧室' }));

    expect(onChange).toHaveBeenCalledWith([
      { media_id: 2, media_type: 'image', label: '卧室' },
      { media_id: 1, media_type: 'image', label: '客厅' },
    ]);
  });
});
