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

    const roleSelect = screen.getByLabelText('客厅角色').closest('.ant-select');
    expect(roleSelect).not.toBeNull();
    fireEvent.mouseDown(roleSelect as Element);
    fireEvent.click(screen.getByText('卧室'));

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

    fireEvent.click(screen.getByRole('button', { name: '将卧室设为首图' }));

    expect(onChange).toHaveBeenCalledWith([
      { media_id: 1, media_type: 'image', label: '客厅' },
      { media_id: 2, media_type: 'image', label: '卧室', image_role: 'cover' },
    ]);
  });

  it('can disable house-specific image roles for building images', () => {
    render(
      <MediaRefsUpload
        mediaType="image"
        resourceType="building_image"
        enableImageRoles={false}
        value={[{ media_id: 1, media_type: 'image', label: '楼栋正门', url: '/building.png' }]}
      />,
    );

    expect(screen.getByAltText('楼栋正门')).toBeInTheDocument();
    expect(screen.queryByLabelText('楼栋正门角色')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '将楼栋正门设为首图' })).not.toBeInTheDocument();
  });

  it('keeps image action button text compact for long filenames', () => {
    render(
      <MediaRefsUpload
        mediaType="image"
        resourceType="house_image"
        value={[
          { media_id: 1, media_type: 'image', label: '客厅' },
          { media_id: 2, media_type: 'image', label: 'IMG_8EB13C6F0C70-1.jpeg', image_role: 'bedroom' },
        ]}
      />,
    );

    const coverButton = screen.getByRole('button', { name: '将IMG_8EB13C6F0C70-1.jpeg设为首图' });
    const moveUpButton = screen.getByRole('button', { name: '上移IMG_8EB13C6F0C70-1.jpeg' });
    const moveDownButton = screen.getByRole('button', { name: '下移IMG_8EB13C6F0C70-1.jpeg' });

    expect(coverButton).toHaveAttribute('aria-label', '将IMG_8EB13C6F0C70-1.jpeg设为首图');
    expect(moveUpButton).toHaveAttribute('aria-label', '上移IMG_8EB13C6F0C70-1.jpeg');
    expect(moveDownButton).toHaveAttribute('aria-label', '下移IMG_8EB13C6F0C70-1.jpeg');
    expect(coverButton).toHaveTextContent('');
    expect(moveUpButton).toHaveTextContent('');
    expect(moveDownButton).toHaveTextContent('');
  });

  it('renders image preview without a separate tag row', () => {
    render(
      <MediaRefsUpload
        mediaType="image"
        resourceType="house_image"
        value={[
          { media_id: 1, media_type: 'image', label: '客厅', image_role: 'cover', url: '/living.png' },
          { media_id: 2, media_type: 'image', label: '卧室', image_role: 'bedroom', url: '/bedroom.png' },
        ]}
      />,
    );

    expect(screen.getByAltText('客厅')).toHaveStyle({ width: '100%', height: 'auto' });
    expect(screen.queryByText('首图')).not.toBeInTheDocument();
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

  it('hides upload button at max count', () => {
    render(
      <MediaRefsUpload
        mediaType="image"
        resourceType="house_image"
        maxCount={1}
        value={[{ media_id: 1, media_type: 'image', label: '客厅', url: '/living.png' }]}
      />,
    );

    expect(screen.queryByRole('button', { name: '上传图片' })).not.toBeInTheDocument();
  });

  it('removes files through the media card action', () => {
    const onChange = vi.fn();
    render(
      <MediaRefsUpload
        mediaType="image"
        resourceType="house_image"
        value={[{ media_id: 1, media_type: 'image', label: '客厅', url: '/living.png' }]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '移除客厅' }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('uses card list for videos with video tag and ordering actions', () => {
    render(
      <MediaRefsUpload
        mediaType="video"
        resourceType="house_video"
        value={[
          { media_id: 1, media_type: 'video', label: '讲解视频.mp4', url: '/tour.mp4' },
          { media_id: 2, media_type: 'video', label: '周边视频.mp4', url: '/area.mp4' },
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: '上移周边视频.mp4' })).toBeInTheDocument();
    expect(screen.queryByLabelText('周边视频.mp4角色')).not.toBeInTheDocument();
  });

  it('previews videos in a modal', () => {
    render(
      <MediaRefsUpload
        mediaType="video"
        resourceType="house_video"
        value={[{ media_id: 1, media_type: 'video', label: '讲解视频.mp4', url: '/tour.mp4' }]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '打开讲解视频.mp4预览' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const video = document.querySelector('video[controls]');
    expect(video).toHaveAttribute('src', '/tour.mp4');
    expect(video).toHaveStyle({ maxHeight: '64vh', objectFit: 'contain' });
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
