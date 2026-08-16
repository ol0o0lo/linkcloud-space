import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HouseMediaHero from '../HouseMediaHero';

describe('HouseMediaHero', () => {
  it('renders images and videos in one navigable media stage', () => {
    render(
      <HouseMediaHero
        images={[
          {
            media_id: 1,
            media_type: 'image',
            label: '客厅照片',
            url: '/living-room.jpg',
          },
        ]}
        videos={[
          {
            media_id: 2,
            media_type: 'video',
            label: '房源视频',
            url: '/tour.mp4',
            thumbnail: '/tour.jpg',
          },
        ]}
      />,
    );

    expect(
      screen.getByRole('region', { name: '房源媒体' }),
    ).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByText('照片')).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: '媒体缩略图' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '上一项媒体' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '下一项媒体' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '查看客厅照片' }),
    ).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: '查看房源视频' }));
    expect(screen.getAllByLabelText('房源视频').length).toBeGreaterThan(0);
  });

  it('renders a clear empty media state', () => {
    render(<HouseMediaHero />);

    expect(
      screen.getByRole('region', { name: '房源媒体' }),
    ).toBeInTheDocument();
    expect(screen.getByText('暂无房源照片或视频')).toBeInTheDocument();
  });
});
