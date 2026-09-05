import { Typography } from 'antd';
import { createStyles } from 'antd-style';
import React, { type ReactNode } from 'react';

type DealSigningSectionProps = {
  children: ReactNode;
  description: ReactNode;
  icon: ReactNode;
  step?: string;
  title: ReactNode;
};

const useStyles = createStyles(({ css, token }) => ({
  section: css`
    min-width: 0;
    overflow: hidden;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
    box-shadow: ${token.boxShadowTertiary};
  `,
  header: css`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 18px 18px 14px;

    @media (max-width: ${token.screenMD}px) {
      padding: 16px 16px 12px;
    }
  `,
  identity: css`
    display: flex;
    min-width: 0;
    align-items: flex-start;
    gap: 10px;
  `,
  icon: css`
    display: grid;
    width: 30px;
    height: 30px;
    flex: 0 0 30px;
    place-items: center;
    border: 1px solid ${token.colorPrimaryBorder};
    border-radius: ${token.borderRadius}px;
    color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
  `,
  copy: css`
    min-width: 0;
  `,
  title: css`
    display: block;
    color: ${token.colorText};
    font-size: ${token.fontSizeLG}px;
    line-height: 22px;
  `,
  description: css`
    display: block;
    margin-top: 3px;
    font-size: ${token.fontSizeSM}px;
    line-height: 1.5;
  `,
  step: css`
    flex: 0 0 auto;
    padding-top: 3px;
    color: ${token.colorTextQuaternary};
    font-size: ${token.fontSizeSM}px;
    font-weight: 700;
    letter-spacing: 0.12em;
  `,
  content: css`
    padding: 0 18px 18px;

    @media (max-width: ${token.screenMD}px) {
      padding: 0 16px 16px;
    }
  `,
}));

const DealSigningSection: React.FC<DealSigningSectionProps> = ({
  children,
  description,
  icon,
  step,
  title,
}) => {
  const { styles } = useStyles();

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
          <div className={styles.copy}>
            <Typography.Text strong className={styles.title}>
              {title}
            </Typography.Text>
            <Typography.Text type="secondary" className={styles.description}>
              {description}
            </Typography.Text>
          </div>
        </div>
        {step ? <span className={styles.step}>{step}</span> : null}
      </header>
      <div className={styles.content}>{children}</div>
    </section>
  );
};

export default DealSigningSection;
