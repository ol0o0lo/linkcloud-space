import {
  LeftOutlined,
  PictureOutlined,
  PlayCircleFilled,
  RightOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { Button, Carousel, Empty, Image, Tag, Typography } from 'antd';
import type { CarouselRef } from 'antd/es/carousel';
import { createStyles } from 'antd-style';
import { useMemo, useRef, useState } from 'react';
import type { MediaRefValue } from '../constants';

export type HouseMediaHeroProps = {
  images?: MediaRefValue[];
  videos?: MediaRefValue[];
};

type HeroMedia = {
  key: string;
  kind: 'image' | 'video';
  title: string;
  item: MediaRefValue;
};

const useStyles = createStyles(({ token, css }) => ({
  root: css`
    position: relative;
    height: 100%;
    min-height: 430px;
    overflow: hidden;
    background: ${token.colorBgSpotlight};

    .ant-carousel,
    .slick-slider,
    .slick-list,
    .slick-track,
    .slick-slide,
    .slick-slide > div {
      height: 100%;
    }

    @media (max-width: 991px) {
      min-height: 360px;
    }
  `,
  slide: css`
    position: relative;
    display: flex !important;
    height: 100%;
    min-height: 430px;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: ${token.colorBgSpotlight};

    @media (max-width: 991px) {
      min-height: 360px;
    }
  `,
  image: css`
    display: block;
    width: 100%;
    height: 100%;

    .ant-image-img {
      display: block;
      width: 100%;
      height: 430px;
      object-fit: cover;

      @media (max-width: 991px) {
        height: 360px;
      }
    }
  `,
  video: css`
    display: block;
    width: 100%;
    height: 430px;
    background: ${token.colorBgSpotlight};
    object-fit: contain;

    @media (max-width: 991px) {
      height: 360px;
    }
  `,
  videoFallback: css`
    display: flex;
    min-height: 430px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: ${token.colorTextLightSolid};

    .anticon {
      font-size: 56px;
    }
  `,
  empty: css`
    display: flex;
    min-height: 430px;
    align-items: center;
    justify-content: center;
    background: ${token.colorFillAlter};
  `,
  topMeta: css`
    position: absolute;
    top: 16px;
    right: 16px;
    left: 16px;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: space-between;
    pointer-events: none;
  `,
  counter: css`
    padding: 5px 10px;
    border-radius: ${token.borderRadiusSM}px;
    background: rgb(0 0 0 / 58%);
    color: ${token.colorTextLightSolid};
    font-size: ${token.fontSizeSM}px;
    backdrop-filter: blur(6px);
  `,
  kindTag: css`
    margin: 0 !important;
    pointer-events: none;
  `,
  arrow: css`
    position: absolute !important;
    top: 50%;
    z-index: 4;
    border-color: rgb(255 255 255 / 28%) !important;
    background: rgb(0 0 0 / 45%) !important;
    color: ${token.colorTextLightSolid} !important;
    transform: translateY(-50%);
    backdrop-filter: blur(6px);
  `,
  arrowPrevious: css`
    left: 16px;
  `,
  arrowNext: css`
    right: 16px;
  `,
  thumbnailRail: css`
    position: absolute;
    right: 20px;
    bottom: 18px;
    left: 20px;
    z-index: 4;
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 8px;
    overflow-x: auto;
    padding: 2px;
  `,
  thumbnail: css`
    position: relative;
    display: flex;
    width: 72px;
    min-width: 72px;
    height: 48px;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 0;
    border: 2px solid transparent;
    border-radius: ${token.borderRadiusSM}px;
    background: ${token.colorBgSpotlight};
    color: ${token.colorTextLightSolid};
    cursor: pointer;
    opacity: 0.72;

    &:focus-visible {
      outline: 3px solid ${token.colorPrimaryBorder};
      outline-offset: 2px;
    }

    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
  thumbnailActive: css`
    border-color: ${token.colorWhite};
    box-shadow: 0 0 0 1px rgb(0 0 0 / 18%);
    opacity: 1;
  `,
  thumbnailPlay: css`
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgb(0 0 0 / 38%);
    font-size: 20px;
  `,
}));

function mediaTitle(item: MediaRefValue, fallback: string) {
  return item.label || item.original_filename || fallback;
}

export default function HouseMediaHero({
  images = [],
  videos = [],
}: HouseMediaHeroProps) {
  const { styles, cx } = useStyles();
  const carouselRef = useRef<CarouselRef>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const mediaItems = useMemo<HeroMedia[]>(
    () => [
      ...[...images]
        .sort((left, right) =>
          left.image_role === right.image_role
            ? 0
            : left.image_role === 'cover'
              ? -1
              : right.image_role === 'cover'
                ? 1
                : 0,
        )
        .map((item, index) => ({
          key: `image-${item.media_id}`,
          kind: 'image' as const,
          title: mediaTitle(item, `房源图片 ${index + 1}`),
          item,
        })),
      ...videos.map((item, index) => ({
        key: `video-${item.media_id}`,
        kind: 'video' as const,
        title: mediaTitle(item, `房源视频 ${index + 1}`),
        item,
      })),
    ],
    [images, videos],
  );
  const current = mediaItems[activeIndex] || mediaItems[0];

  if (!mediaItems.length) {
    return (
      <section aria-label="房源媒体" className={styles.empty}>
        <Empty
          description="暂无房源照片或视频"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </section>
    );
  }

  return (
    <section aria-label="房源媒体" className={styles.root}>
      <Carousel
        afterChange={setActiveIndex}
        dots={false}
        draggable
        ref={carouselRef}
      >
        {mediaItems.map((media) => {
          if (media.kind === 'video') {
            return (
              <div className={styles.slide} key={media.key}>
                {media.item.url ? (
                  <video
                    aria-label={media.title}
                    className={styles.video}
                    controls
                    playsInline
                    poster={media.item.thumbnail || undefined}
                    preload="metadata"
                    src={media.item.url}
                  >
                    <track kind="captions" />
                  </video>
                ) : (
                  <div className={styles.videoFallback}>
                    <VideoCameraOutlined />
                    <Typography.Text type="secondary">
                      暂无可播放视频
                    </Typography.Text>
                  </div>
                )}
              </div>
            );
          }

          const imageUrl = media.item.thumbnail || media.item.url;
          return (
            <div className={styles.slide} key={media.key}>
              {imageUrl ? (
                <Image
                  alt={media.title}
                  preview={media.item.url ? { src: media.item.url } : false}
                  rootClassName={styles.image}
                  src={imageUrl}
                  width="100%"
                />
              ) : (
                <div className={styles.videoFallback}>
                  <PictureOutlined />
                  <Typography.Text type="secondary">
                    暂无可预览图片
                  </Typography.Text>
                </div>
              )}
            </div>
          );
        })}
      </Carousel>

      <div className={styles.topMeta}>
        <span className={styles.counter}>
          {activeIndex + 1} / {mediaItems.length}
        </span>
        <Tag
          className={styles.kindTag}
          color={current?.kind === 'video' ? 'purple' : 'blue'}
          icon={
            current?.kind === 'video' ? (
              <VideoCameraOutlined />
            ) : (
              <PictureOutlined />
            )
          }
        >
          {current?.kind === 'video' ? '视频' : '照片'}
        </Tag>
      </div>

      {mediaItems.length > 1 ? (
        <>
          <Button
            aria-label="上一项媒体"
            className={cx(styles.arrow, styles.arrowPrevious)}
            icon={<LeftOutlined />}
            shape="circle"
            onClick={() => carouselRef.current?.prev()}
          />
          <Button
            aria-label="下一项媒体"
            className={cx(styles.arrow, styles.arrowNext)}
            icon={<RightOutlined />}
            shape="circle"
            onClick={() => carouselRef.current?.next()}
          />
        </>
      ) : null}

      <nav aria-label="媒体缩略图" className={styles.thumbnailRail}>
        {mediaItems.map((media, index) => {
          const thumbnail =
            media.item.thumbnail ||
            (media.kind === 'image' ? media.item.url : undefined);
          return (
            <button
              aria-label={`查看${media.title}`}
              aria-pressed={index === activeIndex}
              className={cx(
                styles.thumbnail,
                index === activeIndex && styles.thumbnailActive,
              )}
              key={media.key}
              type="button"
              onClick={() => carouselRef.current?.goTo(index)}
            >
              {thumbnail ? (
                <img alt="" aria-hidden="true" src={thumbnail} />
              ) : null}
              {media.kind === 'video' ? (
                <span className={styles.thumbnailPlay}>
                  <PlayCircleFilled />
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </section>
  );
}
