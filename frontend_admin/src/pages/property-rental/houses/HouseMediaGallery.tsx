import {
  PictureOutlined,
  SettingOutlined,
  VideoCameraFilled,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { Button, Empty, Image, Modal, Tag, Typography } from 'antd';
import { createStyles } from 'antd-style';
import { useState } from 'react';
import { HOUSE_IMAGE_ROLE_OPTIONS, type MediaRefValue } from '../constants';

export type HouseMediaGalleryProps = {
  images?: MediaRefValue[];
  videos?: MediaRefValue[];
  onManage: () => void;
};

type VideoPreview = {
  title: string;
  url: string;
};

const IMAGE_ROLE_LABELS = new Map(
  HOUSE_IMAGE_ROLE_OPTIONS.map((option) => [option.value, option.label]),
);

const useStyles = createStyles(({ token, css }) => ({
  root: css`
    display: flex;
    flex-direction: column;
    gap: 24px;
  `,
  toolbar: css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  `,
  section: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
  `,
  sectionHeader: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  sectionTitle: css`
    margin: 0 !important;
  `,
  grid: css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
  `,
  card: css`
    min-width: 0;
    overflow: hidden;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
  `,
  mediaFrame: css`
    position: relative;
    display: flex;
    aspect-ratio: 4 / 3;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: ${token.colorFillAlter};
  `,
  image: css`
    display: block;
    width: 100%;
    height: 100%;

    .ant-image-img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
  videoButton: css`
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    padding: 0;
    overflow: hidden;
    color: ${token.colorWhite};
    cursor: pointer;
    border: 0;
    background: ${token.colorBgSpotlight};

    &:focus-visible {
      outline: 3px solid ${token.colorPrimaryBorder};
      outline-offset: -3px;
    }
  `,
  videoThumbnail: css`
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.78;
  `,
  videoFallback: css`
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
    color: ${token.colorTextLightSolid};
    font-size: 36px;
  `,
  playIcon: css`
    position: absolute;
    top: 50%;
    left: 50%;
    display: flex;
    width: 48px;
    height: 48px;
    align-items: center;
    justify-content: center;
    border: 1px solid rgb(255 255 255 / 45%);
    border-radius: 50%;
    background: rgb(0 0 0 / 52%);
    box-shadow: ${token.boxShadowSecondary};
    font-size: 24px;
    transform: translate(-50%, -50%);
  `,
  missingMedia: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    color: ${token.colorTextDescription};
    text-align: center;

    .anticon {
      font-size: 32px;
    }
  `,
  meta: css`
    display: flex;
    min-width: 0;
    min-height: 72px;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 12px;
  `,
  filename: css`
    width: 100%;
  `,
  empty: css`
    padding: 24px 16px;
    border: 1px dashed ${token.colorBorder};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};
  `,
  video: css`
    display: block;
    width: 100%;
    max-height: 72vh;
    background: ${token.colorBgSpotlight};
    object-fit: contain;
  `,
}));

function mediaTitle(item: MediaRefValue, fallback: string) {
  return item.label || item.original_filename || fallback;
}

function imageRoleLabel(role?: string) {
  if (!role) return '未分类';
  return IMAGE_ROLE_LABELS.get(role) || role;
}

export default function HouseMediaGallery({
  images = [],
  videos = [],
  onManage,
}: HouseMediaGalleryProps) {
  const { styles } = useStyles();
  const [previewVideo, setPreviewVideo] = useState<VideoPreview>();

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <Typography.Text type="secondary">
          {images.length} 张图片 · {videos.length} 个视频
        </Typography.Text>
        <Button
          aria-label="管理媒体"
          icon={<SettingOutlined />}
          onClick={onManage}
        >
          管理媒体
        </Button>
      </div>

      <section className={styles.section} aria-label="房源图片">
        <div className={styles.sectionHeader}>
          <PictureOutlined />
          <Typography.Title className={styles.sectionTitle} level={5}>
            图片
          </Typography.Title>
          <Tag variant="filled">{images.length}</Tag>
        </div>
        {images.length ? (
          <div className={styles.grid}>
            {images.map((item, index) => {
              const title = mediaTitle(item, `房源图片 ${index + 1}`);
              const displayUrl = item.thumbnail || item.url;

              return (
                <article className={styles.card} key={item.media_id}>
                  <div className={styles.mediaFrame}>
                    {displayUrl ? (
                      <Image
                        alt={title}
                        height="100%"
                        preview={item.url ? { src: item.url } : false}
                        rootClassName={styles.image}
                        src={displayUrl}
                        width="100%"
                      />
                    ) : (
                      <div className={styles.missingMedia}>
                        <PictureOutlined />
                        <span>暂无可预览图片</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.meta}>
                    <Typography.Text
                      className={styles.filename}
                      ellipsis={{ tooltip: title }}
                      strong
                    >
                      {title}
                    </Typography.Text>
                    <Tag
                      color={
                        item.image_role
                          ? item.image_role === 'cover'
                            ? 'gold'
                            : 'blue'
                          : undefined
                      }
                    >
                      {imageRoleLabel(item.image_role)}
                    </Tag>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>
            <Empty
              description="暂无房源图片"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        )}
      </section>

      <section className={styles.section} aria-label="房源视频">
        <div className={styles.sectionHeader}>
          <VideoCameraOutlined />
          <Typography.Title className={styles.sectionTitle} level={5}>
            视频
          </Typography.Title>
          <Tag variant="filled">{videos.length}</Tag>
        </div>
        {videos.length ? (
          <div className={styles.grid}>
            {videos.map((item, index) => {
              const title = mediaTitle(item, `房源视频 ${index + 1}`);
              const videoUrl = item.url;

              return (
                <article className={styles.card} key={item.media_id}>
                  <div className={styles.mediaFrame}>
                    {videoUrl ? (
                      <button
                        aria-label={`播放${title}`}
                        className={styles.videoButton}
                        type="button"
                        onClick={() =>
                          setPreviewVideo({ title, url: videoUrl })
                        }
                      >
                        {item.thumbnail ? (
                          <img
                            alt=""
                            aria-hidden="true"
                            className={styles.videoThumbnail}
                            src={item.thumbnail}
                          />
                        ) : (
                          <span className={styles.videoFallback}>
                            <VideoCameraOutlined />
                          </span>
                        )}
                        <span className={styles.playIcon}>
                          <VideoCameraFilled />
                        </span>
                      </button>
                    ) : (
                      <div className={styles.missingMedia}>
                        <VideoCameraOutlined />
                        <span>暂无可播放视频</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.meta}>
                    <Typography.Text
                      className={styles.filename}
                      ellipsis={{ tooltip: title }}
                      strong
                    >
                      {title}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      {videoUrl ? '点击播放' : '暂不可播放'}
                    </Typography.Text>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>
            <Empty
              description="暂无房源视频"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        )}
      </section>

      <Modal
        centered
        destroyOnHidden
        footer={null}
        open={Boolean(previewVideo)}
        title={previewVideo?.title}
        width={760}
        onCancel={() => setPreviewVideo(undefined)}
      >
        {previewVideo ? (
          <video
            autoPlay
            className={styles.video}
            controls
            playsInline
            src={previewVideo.url}
          >
            <track kind="captions" />
          </video>
        ) : null}
      </Modal>
    </div>
  );
}
