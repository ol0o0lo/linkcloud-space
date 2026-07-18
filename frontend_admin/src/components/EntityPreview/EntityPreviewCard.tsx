import { PictureOutlined } from '@ant-design/icons';
import { Image, Typography } from 'antd';
import { createStyles } from 'antd-style';
import { type ReactNode, useEffect, useState } from 'react';

const useStyles = createStyles(({ css, token }) => ({
  card: css`
    display: flex;
    width: 100%;
    max-height: min(640px, calc(100vh - 32px));
    flex-direction: column;
    overflow: hidden;
    background: ${token.colorBgElevated};
  `,
  media: css`
    height: 124px;
    flex: 0 0 124px;
    overflow: hidden;
    background: ${token.colorFillTertiary};
  `,
  mediaPlaceholder: css`
    display: flex;
    height: 124px;
    flex: 0 0 124px;
    align-items: center;
    justify-content: center;
    color: ${token.colorTextSecondary};
    background: linear-gradient(
      145deg,
      ${token.colorFillTertiary},
      ${token.colorFillQuaternary}
    );
  `,
  mediaPlaceholderContent: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${token.marginXXS}px;
    font-size: ${token.fontSizeSM}px;
  `,
  header: css`
    flex: 0 0 auto;
    padding: ${token.paddingXS}px ${token.paddingSM}px;
  `,
  headerTop: css`
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: ${token.marginXS}px;
    align-items: start;
  `,
  headerMain: css`
    min-width: 0;
  `,
  title: css`
    display: block;
    color: ${token.colorTextHeading};
    font-size: ${token.fontSizeLG}px;
    line-height: ${token.lineHeightLG};
  `,
  subtitle: css`
    display: block;
    margin-top: ${token.marginXXS}px;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
    line-height: ${token.lineHeightSM};
  `,
  highlight: css`
    margin-top: ${token.marginXS}px;
  `,
  headerTags: css`
    margin-top: ${token.marginXS}px;
  `,
  body: css`
    min-height: 0;
    flex: 1 1 auto;
    overflow-y: auto;
    border-top: 1px solid ${token.colorSplit};

    &:focus-visible {
      outline: 2px solid ${token.colorPrimaryBorder};
      outline-offset: -2px;
    }
  `,
  section: css`
    display: flex;
    flex-direction: column;
    gap: ${token.marginSM}px;
    padding: ${token.paddingXS}px ${token.paddingSM}px;
  `,
  factGrid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: ${token.marginXS}px ${token.marginSM}px;

    @media (max-width: 520px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  fact: css`
    min-width: 0;
  `,
  factFull: css`
    grid-column: 1 / -1;
  `,
  label: css`
    margin-bottom: ${token.marginXXS}px;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
  `,
  value: css`
    color: ${token.colorText};
    font-size: ${token.fontSize}px;
    line-height: ${token.lineHeight};
    overflow-wrap: anywhere;
  `,
  fieldList: css`
    display: flex;
    flex-direction: column;
    gap: ${token.marginXS}px;
  `,
  field: css`
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    gap: ${token.marginXS}px;
    align-items: start;

    @media (max-width: 520px) {
      grid-template-columns: minmax(0, 1fr);
      gap: ${token.marginXXS}px;
    }
  `,
  fieldLabel: css`
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
  `,
  fieldValue: css`
    min-width: 0;
    color: ${token.colorText};
    font-size: ${token.fontSizeSM}px;
    line-height: ${token.lineHeight};
    overflow-wrap: anywhere;
    white-space: normal;
  `,
  footer: css`
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: space-between;
    gap: ${token.marginXS}px;
    padding: ${token.paddingXXS}px ${token.paddingSM}px;
    border-top: 1px solid ${token.colorSplit};
    color: ${token.colorTextTertiary};
    background: ${token.colorFillQuaternary};
    font-size: ${token.fontSizeSM}px;
  `,
}));

interface EntityPreviewCardProps {
  ariaLabel: string;
  children: ReactNode;
  footerMeta?: ReactNode;
}

export function EntityPreviewCard({
  ariaLabel,
  children,
  footerMeta,
}: EntityPreviewCardProps) {
  const { styles } = useStyles();

  return (
    <section aria-label={ariaLabel} className={styles.card}>
      {children}
      <footer className={styles.footer}>
        <span>{footerMeta}</span>
      </footer>
    </section>
  );
}

interface EntityPreviewMediaProps {
  alt: string;
  entityLabel: string;
  src?: string | null;
}

export function EntityPreviewMedia({
  alt,
  entityLabel,
  src,
}: EntityPreviewMediaProps) {
  const { styles } = useStyles();
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div className={styles.mediaPlaceholder}>
        <span className={styles.mediaPlaceholderContent}>
          <PictureOutlined style={{ fontSize: 28 }} />
          暂无{entityLabel}图片
        </span>
      </div>
    );
  }

  return (
    <div className={styles.media}>
      <Image
        alt={alt}
        height={124}
        onError={() => setFailed(true)}
        preview={false}
        src={src}
        styles={{
          root: { height: '100%', width: '100%' },
          image: { height: '100%', objectFit: 'cover', width: '100%' },
        }}
        width="100%"
      />
    </div>
  );
}

interface EntityPreviewHeaderProps {
  aside?: ReactNode;
  highlight?: ReactNode;
  leading?: ReactNode;
  subtitle?: ReactNode;
  tags?: ReactNode;
  title: ReactNode;
}

export function EntityPreviewHeader({
  aside,
  highlight,
  leading,
  subtitle,
  tags,
  title,
}: EntityPreviewHeaderProps) {
  const { styles } = useStyles();

  return (
    <header className={styles.header}>
      <div className={styles.headerTop}>
        {leading ?? <span />}
        <div className={styles.headerMain}>
          <Typography.Text className={styles.title} strong>
            {title}
          </Typography.Text>
          {subtitle ? (
            <Typography.Text className={styles.subtitle}>
              {subtitle}
            </Typography.Text>
          ) : null}
        </div>
        {aside ?? <span />}
      </div>
      {highlight ? <div className={styles.highlight}>{highlight}</div> : null}
      {tags ? <div className={styles.headerTags}>{tags}</div> : null}
    </header>
  );
}

export function EntityPreviewCardBody({ children }: { children: ReactNode }) {
  const { styles } = useStyles();
  return (
    <section
      aria-label="预览详情内容"
      className={styles.body}
      data-entity-preview-scroll
      // biome-ignore lint/a11y/noNoninteractiveTabindex: 滚动详情区需要可通过键盘获取焦点以查看超长内容
      tabIndex={0}
    >
      {children}
    </section>
  );
}

export function EntityPreviewSection({ children }: { children: ReactNode }) {
  const { styles } = useStyles();
  return <div className={styles.section}>{children}</div>;
}

export function EntityPreviewFactGrid({ children }: { children: ReactNode }) {
  const { styles } = useStyles();
  return <div className={styles.factGrid}>{children}</div>;
}

export function EntityPreviewFact({
  full,
  label,
  value,
}: {
  full?: boolean;
  label: ReactNode;
  value: ReactNode;
}) {
  const { styles } = useStyles();
  return (
    <div className={`${styles.fact} ${full ? styles.factFull : ''}`}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{value}</div>
    </div>
  );
}

export function EntityPreviewFieldList({ children }: { children: ReactNode }) {
  const { styles } = useStyles();
  return <div className={styles.fieldList}>{children}</div>;
}

export function EntityPreviewField({
  label,
  value,
}: {
  label: ReactNode;
  value: ReactNode;
}) {
  const { styles } = useStyles();
  return (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.fieldValue}>{value}</div>
    </div>
  );
}
