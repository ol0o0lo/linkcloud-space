import {
  CalendarOutlined,
  EnvironmentOutlined,
  HeartFilled,
  HeartOutlined,
  PictureOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Empty,
  Image,
  message,
  Pagination,
  Popconfirm,
  Spin,
  Tabs,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { PageContainer } from '@/components/PageContainer';
import { favoriteKeys } from '@/services/manual/favoriteHooks';
import type { FavoriteItem } from '@/services/manual/favorites';
import {
  getFavoriteTypes,
  getMyFavorites,
  removeFavorite,
} from '@/services/manual/favorites';
import './targets';
import {
  normalizeFavoriteTargetTypes,
  type ResolvedFavoriteTargetDefinition,
  resolveFavoriteTargetDefinition,
} from './targetRegistry';

const PAGE_SIZE = 12;

const useStyles = createStyles(({ css, token }) => ({
  page: css`
    width: 100%;
    max-width: 1320px;
    margin: 0 auto;
  `,
  hero: css`
    position: relative;
    display: flex;
    min-height: 190px;
    align-items: center;
    justify-content: space-between;
    gap: 32px;
    overflow: hidden;
    padding: 34px 40px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG * 2}px;
    background:
      radial-gradient(circle at 84% 12%, ${token.colorErrorBg} 0, transparent 32%),
      linear-gradient(135deg, ${token.colorPrimaryBg}, ${token.colorBgContainer} 68%);

    &::after {
      position: absolute;
      width: 220px;
      height: 220px;
      border: 42px solid ${token.colorPrimaryBorder};
      border-radius: 50%;
      content: '';
      opacity: 0.16;
      right: -82px;
      bottom: -132px;
      pointer-events: none;
    }

    @media (max-width: 767px) {
      min-height: auto;
      padding: 28px 24px;
    }
  `,
  heroContent: css`
    position: relative;
    z-index: 1;
    min-width: 0;
    max-width: 720px;
  `,
  eyebrow: css`
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 10px;
    color: ${token.colorError};
    font-size: ${token.fontSizeSM}px;
    font-weight: ${token.fontWeightStrong};
    letter-spacing: 0.08em;
  `,
  heroTitle: css`
    margin: 0 !important;
    color: ${token.colorTextHeading} !important;
    font-size: clamp(20px, 4vw, 30px) !important;
    letter-spacing: -0.02em;
  `,
  heroDescription: css`
    max-width: 620px;
    margin: 12px 0 0 !important;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeLG}px;
    line-height: 1.75;

    @media (max-width: 575px) {
      font-size: ${token.fontSize}px;
    }
  `,
  heroIcon: css`
    position: relative;
    z-index: 1;
    display: flex;
    width: 98px;
    height: 98px;
    flex: 0 0 98px;
    align-items: center;
    justify-content: center;
    border: 1px solid ${token.colorErrorBorder};
    border-radius: 32px;
    color: ${token.colorError};
    background: color-mix(in srgb, ${token.colorBgContainer} 82%, transparent);
    box-shadow: ${token.boxShadowSecondary};
    font-size: 44px;
    transform: rotate(5deg);

    @media (max-width: 767px) {
      display: none;
    }
  `,
  tabs: css`
    margin-top: 24px;

    .ant-tabs-nav {
      margin: 0;
    }

    .ant-tabs-nav::before {
      display: none;
    }

    .ant-tabs-nav-list {
      gap: 4px;
      padding: 6px;
      border: 1px solid ${token.colorBorderSecondary};
      border-radius: 999px;
      background: ${token.colorFillQuaternary};
    }

    .ant-tabs-tab {
      margin: 0 !important;
      padding: 10px 22px;
      border-radius: 999px;
      transition:
        color ${token.motionDurationMid},
        background ${token.motionDurationMid},
        box-shadow ${token.motionDurationMid};
    }

    .ant-tabs-tab:hover {
      color: ${token.colorPrimary};
    }

    .ant-tabs-tab-active {
      background: ${token.colorBgContainer};
      box-shadow: 0 4px 14px rgb(15 23 42 / 8%);
    }

    .ant-tabs-ink-bar {
      display: none;
    }

    @media (max-width: 575px) {
      .ant-tabs-nav-list {
        width: 100%;
      }

      .ant-tabs-tab {
        flex: 1 1 0;
        justify-content: center;
        padding-inline: 14px;
      }
    }
  `,
  sectionHeader: css`
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px;
    margin: 30px 0 18px;

    @media (max-width: 575px) {
      align-items: flex-start;
      flex-direction: column;
      gap: 12px;
    }
  `,
  sectionTitle: css`
    margin: 0 !important;
  `,
  sectionDescription: css`
    display: block;
    max-width: 720px;
    margin-top: 7px;
    color: ${token.colorTextSecondary};
    line-height: 1.7;
  `,
  resultCount: css`
    display: inline-flex;
    min-height: 34px;
    flex: 0 0 auto;
    align-items: center;
    padding: 6px 13px;
    border-radius: 999px;
    color: ${token.colorTextSecondary};
    background: ${token.colorFillQuaternary};
    font-size: ${token.fontSizeSM}px;
  `,
  error: css`
    margin-bottom: 18px;
  `,
  grid: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;

    @media (max-width: 1199px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 767px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  loadingState: css`
    display: flex;
    min-height: 360px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: ${token.colorTextSecondary};
  `,
  cardArticle: css`
    width: 100%;
    height: 100%;
  `,
  card: css`
    height: 100%;
    overflow: hidden;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG * 1.5}px;
    background: ${token.colorBgContainer};
    box-shadow: 0 10px 30px rgb(15 23 42 / 5%);
    transition:
      border-color ${token.motionDurationMid},
      box-shadow ${token.motionDurationMid},
      transform ${token.motionDurationMid};

    &:hover {
      border-color: ${token.colorPrimaryBorder};
      box-shadow: ${token.boxShadowSecondary};
      transform: translateY(-2px);
    }
  `,
  media: css`
    position: relative;
    overflow: hidden;
    aspect-ratio: 4 / 3;
    background: ${token.colorFillTertiary};

    .ant-image,
    .ant-image-img {
      display: block;
      width: 100%;
      height: 100%;
    }

    .ant-image-img {
      object-fit: cover;
      transition: transform ${token.motionDurationMid};
    }

    &:hover .ant-image-img {
      transform: scale(1.025);
    }
  `,
  mediaUnavailable: css`
    .ant-image-img {
      filter: grayscale(0.72);
      opacity: 0.72;
    }
  `,
  mediaPlaceholder: css`
    display: flex;
    width: 100%;
    height: 100%;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: ${token.colorTextTertiary};
    background: linear-gradient(145deg, ${token.colorFillTertiary}, ${token.colorPrimaryBg});

    .anticon {
      color: ${token.colorPrimary};
      font-size: 38px;
    }
  `,
  statusTag: css`
    position: absolute;
    z-index: 2;
    top: 14px;
    left: 14px;
    margin: 0 !important;
    padding: 4px 10px;
    border: 0;
    border-radius: 999px;
    background: rgb(15 23 42 / 72%);
    color: ${token.colorTextLightSolid};
    backdrop-filter: blur(8px);
  `,
  favoriteButton: css`
    position: absolute !important;
    z-index: 3;
    top: 12px;
    right: 12px;
    width: 42px !important;
    height: 42px !important;
    border: 1px solid rgb(255 255 255 / 72%) !important;
    color: ${token.colorError} !important;
    background: rgb(255 255 255 / 90%) !important;
    box-shadow: 0 6px 18px rgb(15 23 42 / 14%);
    backdrop-filter: blur(10px);

    &:hover,
    &:focus-visible {
      border-color: ${token.colorErrorBorder} !important;
      background: ${token.colorBgContainer} !important;
      transform: scale(1.06);
    }
  `,
  cardBody: css`
    display: flex;
    min-height: 248px;
    flex-direction: column;
    padding: 19px 20px 17px;
  `,
  publisher: css`
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 7px;
    margin-bottom: 9px;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;

    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
  cardTitle: css`
    margin: 0 !important;
    color: ${token.colorTextHeading} !important;
    line-height: 1.45 !important;
  `,
  location: css`
    display: flex;
    min-width: 0;
    align-items: flex-start;
    gap: 7px;
    margin-top: 8px;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
    line-height: 1.6;

    .anticon {
      flex: 0 0 auto;
      margin-top: 4px;
      color: ${token.colorTextTertiary};
    }
  `,
  highlights: css`
    display: flex;
    min-height: 34px;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 8px 10px;
    margin-top: 16px;
  `,
  rent: css`
    color: ${token.colorError};
    font-size: 22px;
    font-weight: ${token.fontWeightStrong};
    letter-spacing: -0.02em;
  `,
  fact: css`
    display: inline-flex;
    align-items: center;
    padding: 4px 9px;
    border-radius: 999px;
    color: ${token.colorTextSecondary};
    background: ${token.colorFillQuaternary};
    font-size: ${token.fontSizeSM}px;
  `,
  description: css`
    margin: 14px 0 0 !important;
    color: ${token.colorTextSecondary};
    line-height: 1.7;
  `,
  unavailableNotice: css`
    margin-top: 16px;
    padding: 12px 14px;
    border-radius: ${token.borderRadiusLG}px;
    color: ${token.colorTextSecondary};
    background: ${token.colorFillQuaternary};
    font-size: ${token.fontSizeSM}px;
    line-height: 1.65;
  `,
  featureTags: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 14px;
  `,
  featureTag: css`
    padding: 4px 9px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 999px;
    color: ${token.colorTextSecondary};
    background: ${token.colorBgContainer};
    font-size: ${token.fontSizeSM}px;
  `,
  cardFooter: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px 12px;
    margin-top: auto;
    padding-top: 17px;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;

    span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
  `,
  emptyState: css`
    display: flex;
    min-height: 360px;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    border: 1px dashed ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG * 1.5}px;
    background: linear-gradient(145deg, ${token.colorBgContainer}, ${token.colorFillQuaternary});

    .ant-empty-description {
      margin-top: 18px;
    }
  `,
  emptyIcon: css`
    color: ${token.colorError};
    font-size: 66px;
    opacity: 0.78;
  `,
  emptyTitle: css`
    display: block;
    color: ${token.colorTextHeading};
    font-size: ${token.fontSizeLG}px;
  `,
  emptyDescription: css`
    display: block;
    max-width: 360px;
    margin-top: 7px;
    color: ${token.colorTextSecondary};
    line-height: 1.7;
  `,
  pagination: css`
    display: flex;
    justify-content: center;
    padding: 10px 0 4px;
  `,
}));

function FavoriteCard({
  item,
  definition,
  removing,
  onRemove,
}: {
  item: FavoriteItem;
  definition: ResolvedFavoriteTargetDefinition;
  removing: boolean;
  onRemove: () => void;
}) {
  const { styles, cx } = useStyles();
  const presentation = definition.renderer(item, definition.metadata);
  const { coverUrl, description, facts, publisher, subtitle, tags, title } =
    presentation;

  return (
    <article aria-label={title} className={styles.cardArticle}>
      <Card
        className={styles.card}
        styles={{ body: { height: '100%', padding: 0 } }}
      >
        <div
          className={cx(
            styles.media,
            !item.available && styles.mediaUnavailable,
          )}
        >
          {coverUrl ? (
            <Image
              alt={title}
              preview={false}
              src={coverUrl}
              styles={{
                image: { height: '100%', objectFit: 'cover', width: '100%' },
                root: { height: '100%', width: '100%' },
              }}
            />
          ) : (
            <div className={styles.mediaPlaceholder}>
              <PictureOutlined />
              <span>
                {item.available
                  ? `暂无${definition.displayName}图片`
                  : '内容暂不可见'}
              </span>
            </div>
          )}

          {!item.available ? (
            <span className={styles.statusTag}>已下架</span>
          ) : null}

          <Popconfirm
            cancelText="暂不取消"
            description="取消后，这条内容将从你的收藏中移除。"
            okButtonProps={{ danger: true, loading: removing }}
            okText="确认取消"
            title="确认取消收藏吗？"
            onConfirm={onRemove}
          >
            <Button
              aria-label={`取消收藏：${title}`}
              className={styles.favoriteButton}
              icon={<HeartFilled />}
              loading={removing}
              shape="circle"
              title="取消收藏"
              type="text"
            />
          </Popconfirm>
        </div>

        <div className={styles.cardBody}>
          {publisher ? (
            <div className={styles.publisher}>
              <UserOutlined />
              <span>{publisher}</span>
            </div>
          ) : null}

          <Typography.Title className={styles.cardTitle} level={4}>
            {title}
          </Typography.Title>
          <div className={styles.location}>
            <EnvironmentOutlined />
            <span>{subtitle}</span>
          </div>

          {facts.length ? (
            <div className={styles.highlights}>
              {facts.map((fact) => (
                <span
                  className={fact.emphasis ? styles.rent : styles.fact}
                  key={`${fact.label}:${fact.value}`}
                  title={fact.label}
                >
                  {fact.value}
                </span>
              ))}
            </div>
          ) : null}

          {description ? (
            <Typography.Paragraph
              className={styles.description}
              ellipsis={{ rows: 2 }}
            >
              {description}
            </Typography.Paragraph>
          ) : null}

          {!item.available ? (
            <div className={styles.unavailableNotice}>
              该目标当前不再公开，收藏关系仍为你保留，你也可以随时取消收藏。
            </div>
          ) : null}

          {tags.length ? (
            <div className={styles.featureTags}>
              {tags.slice(0, 3).map((tag) => (
                <span className={styles.featureTag} key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <footer className={styles.cardFooter}>
            <span>
              <CalendarOutlined />
              {dayjs(item.created_at).format('YYYY年M月D日')}收藏
            </span>
            <span>{definition.displayName}</span>
          </footer>
        </div>
      </Card>
    </article>
  );
}

export default function FavoritesPage() {
  const { styles } = useStyles();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [targetType, setTargetType] = useState<string>();
  const favoriteTypesQuery = useQuery({
    queryKey: favoriteKeys.types(),
    queryFn: getFavoriteTypes,
  });
  const favoriteTypes = useMemo(
    () => normalizeFavoriteTargetTypes(favoriteTypesQuery.data || []),
    [favoriteTypesQuery.data],
  );
  const definitions = useMemo(
    () => favoriteTypes.map(resolveFavoriteTargetDefinition),
    [favoriteTypes],
  );
  const definitionsByType = useMemo(
    () => new Map(definitions.map((item) => [item.targetType, item])),
    [definitions],
  );
  const activeTargetType =
    (targetType && definitionsByType.has(targetType) && targetType) ||
    definitions[0]?.targetType;
  const activeDefinition = activeTargetType
    ? definitionsByType.get(activeTargetType)
    : undefined;
  const favoritesQuery = useQuery({
    queryKey: activeTargetType
      ? favoriteKeys.list({
          target_type: activeTargetType,
          page,
          page_size: PAGE_SIZE,
        })
      : [...favoriteKeys.lists(), 'disabled'],
    queryFn: () =>
      getMyFavorites({
        target_type: activeTargetType,
        page,
        page_size: PAGE_SIZE,
      }),
    enabled: Boolean(activeTargetType),
  });
  const removeMutation = useMutation({
    mutationFn: (item: FavoriteItem) =>
      removeFavorite(item.target_type, item.target_id),
    onSuccess: async (_, item) => {
      message.success('已取消收藏');
      if ((favoritesQuery.data?.items.length || 0) === 1 && page > 1) {
        setPage((current) => current - 1);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: favoriteKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: favoriteKeys.types() }),
        queryClient.invalidateQueries({
          queryKey: favoriteKeys.target(item.target_type, item.target_id),
        }),
      ]);
    },
    onError: () => message.error('取消收藏失败，请稍后重试'),
  });

  const items = favoritesQuery.data?.items || [];
  const total =
    favoritesQuery.data?.total ??
    activeDefinition?.metadata.favorite_count ??
    0;

  return (
    <PageContainer title="我的收藏">
      <main className={styles.page}>
        <section aria-labelledby="favorites-page-title" className={styles.hero}>
          <div className={styles.heroContent}>
            <span className={styles.eyebrow}>
              <HeartFilled aria-hidden />
              个人收藏
            </span>
            <Typography.Title
              className={styles.heroTitle}
              id="favorites-page-title"
              level={1}
            >
              我的收藏
            </Typography.Title>
            <Typography.Paragraph className={styles.heroDescription}>
              把中意的放在一起，随时回来继续比较，慢慢找到更适合自己的。
            </Typography.Paragraph>
          </div>
          <div aria-hidden className={styles.heroIcon}>
            <HeartFilled />
          </div>
        </section>

        {favoriteTypesQuery.isError ? (
          <Alert
            action={
              <Button
                size="small"
                onClick={() => void favoriteTypesQuery.refetch()}
              >
                重新加载
              </Button>
            }
            className={styles.error}
            description="暂时无法读取可用的收藏类型，请检查网络后重试。"
            showIcon
            title="收藏类型加载失败"
            type="error"
          />
        ) : null}

        {definitions.length ? (
          <Tabs
            activeKey={activeTargetType}
            className={styles.tabs}
            items={definitions.map((definition) => ({
              icon: definition.icon,
              key: definition.targetType,
              label: definition.displayName,
            }))}
            onChange={(key) => {
              setTargetType(key);
              setPage(1);
            }}
          />
        ) : null}

        <section aria-live="polite">
          {activeDefinition ? (
            <div className={styles.sectionHeader}>
              <div>
                <Typography.Title className={styles.sectionTitle} level={3}>
                  {activeDefinition.displayName}收藏
                </Typography.Title>
                <Typography.Text className={styles.sectionDescription}>
                  {activeDefinition.description}
                </Typography.Text>
              </div>
              <span className={styles.resultCount}>
                {favoritesQuery.isLoading ? '正在整理收藏…' : `共 ${total} 项`}
              </span>
            </div>
          ) : null}

          {favoritesQuery.isError ? (
            <Alert
              action={
                <Button
                  size="small"
                  onClick={() => void favoritesQuery.refetch()}
                >
                  重新加载
                </Button>
              }
              className={styles.error}
              description="请检查网络后重试，你的收藏记录不会因此丢失。"
              showIcon
              title="收藏暂时加载失败"
              type="error"
            />
          ) : null}

          {favoriteTypesQuery.isLoading ? (
            <div className={styles.loadingState}>
              <Spin size="large" />
              <Typography.Text type="secondary">
                正在读取收藏类型…
              </Typography.Text>
            </div>
          ) : favoriteTypesQuery.isError ? null : !activeDefinition ? (
            <div className={styles.emptyState}>
              <Empty
                description={
                  <span>
                    <Typography.Text className={styles.emptyTitle} strong>
                      暂无可用的收藏类型
                    </Typography.Text>
                    <Typography.Text className={styles.emptyDescription}>
                      业务接入收藏能力后，会自动出现在这里。
                    </Typography.Text>
                  </span>
                }
                image={<HeartOutlined className={styles.emptyIcon} />}
              />
            </div>
          ) : favoritesQuery.isLoading ? (
            <div className={styles.loadingState}>
              <Spin size="large" />
              <Typography.Text type="secondary">
                正在整理你的收藏…
              </Typography.Text>
            </div>
          ) : items.length ? (
            <div className={styles.grid}>
              {items.map((item) => (
                <FavoriteCard
                  definition={
                    definitionsByType.get(item.target_type) || activeDefinition
                  }
                  item={item}
                  key={item.id}
                  removing={
                    removeMutation.isPending &&
                    removeMutation.variables?.id === item.id
                  }
                  onRemove={() => removeMutation.mutate(item)}
                />
              ))}
            </div>
          ) : favoritesQuery.isError ? null : (
            <div className={styles.emptyState}>
              <Empty
                description={
                  <span>
                    <Typography.Text className={styles.emptyTitle} strong>
                      {activeDefinition.emptyTitle}
                    </Typography.Text>
                    <Typography.Text className={styles.emptyDescription}>
                      {activeDefinition.emptyDescription}
                    </Typography.Text>
                  </span>
                }
                image={<HeartOutlined className={styles.emptyIcon} />}
              />
            </div>
          )}

          {total > PAGE_SIZE ? (
            <div className={styles.pagination}>
              <Pagination
                current={page}
                pageSize={PAGE_SIZE}
                showSizeChanger={false}
                showTotal={(count) => `共 ${count} 项收藏`}
                total={total}
                onChange={setPage}
              />
            </div>
          ) : null}
        </section>
      </main>
    </PageContainer>
  );
}
