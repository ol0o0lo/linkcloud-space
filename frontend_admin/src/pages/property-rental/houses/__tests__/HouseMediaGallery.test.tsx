import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HouseMediaGallery from '../HouseMediaGallery';

describe('HouseMediaGallery', () => {
  it('renders image thumbnails and role labels without edit controls', async () => {
    render(
      <HouseMediaGallery
        images={[
          {
            media_id: 1,
            media_type: 'image',
            label: '客厅',
            image_role: 'cover',
            thumbnail: '/cover-thumb.jpg',
            url: '/cover.jpg',
          },
          {
            media_id: 2,
            media_type: 'image',
            label: '主卧',
            image_role: 'bedroom',
            url: '/bedroom.jpg',
          },
        ]}
        onManage={vi.fn()}
      />,
    );

    expect(screen.getByAltText('客厅')).toHaveAttribute(
      'src',
      '/cover-thumb.jpg',
    );
    expect(screen.getByAltText('主卧')).toHaveAttribute('src', '/bedroom.jpg');
    expect(screen.getByText('封面')).toBeInTheDocument();
    expect(screen.getByText('卧室')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText('上传图片')).not.toBeInTheDocument();
    expect(screen.queryByText('移除')).not.toBeInTheDocument();

    fireEvent.click(screen.getByAltText('客厅'));
    await waitFor(() => {
      expect(document.querySelector('.ant-image-preview-img')).toHaveAttribute(
        'src',
        '/cover.jpg',
      );
    });
  });

  it('opens a playable video modal', () => {
    render(
      <HouseMediaGallery
        videos={[
          {
            media_id: 3,
            media_type: 'video',
            label: '全屋讲解',
            url: '/tour.mp4',
          },
        ]}
        onManage={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '播放全屋讲解' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const video = document.querySelector('video[controls]');
    expect(video).toHaveAttribute('src', '/tour.mp4');
  });

  it('renders separate empty states and calls the manage callback', () => {
    const onManage = vi.fn();
    render(<HouseMediaGallery onManage={onManage} />);

    expect(screen.getByText('暂无房源图片')).toBeInTheDocument();
    expect(screen.getByText('暂无房源视频')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '管理媒体' }));
    expect(onManage).toHaveBeenCalledOnce();
  });
});
