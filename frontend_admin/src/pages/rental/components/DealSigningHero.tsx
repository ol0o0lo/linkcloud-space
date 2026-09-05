import { Skeleton, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React, { type ReactNode } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { AppStatusTag } from '@/components/AppStatus';
import { HousePreview } from '@/components/EntityPreview';
import { enumMapping } from '@/services/manual/enums';
import type { HouseOut } from '@/services/manual/house';
import { HOUSE_STATUS, housePrimaryLayoutText, moneyText } from '../constants';

type DealSigningHeroProps = {
  displayName: string;
  house?: HouseOut;
  houseId?: number;
  loading?: boolean;
  selector?: ReactNode;
};

const useStyles = createStyles(({ css, token }) => ({
  hero: css`
    position: relative;
    overflow: clip;
    margin-bottom: 14px;
    border: 1px solid ${token.colorPrimaryBorder};
    border-radius: ${token.borderRadiusLG}px;
    background: linear-gradient(
      132deg,
      ${token.colorPrimaryBg} 0%,
      ${token.colorBgContainer} 54%,
      ${token.colorSuccessBg} 100%
    );
    box-shadow: ${token.boxShadowTertiary};
  `,
  glow: css`
    position: absolute;
    top: -74px;
    right: 16%;
    width: 154px;
    height: 154px;
    border: 24px solid ${token.colorPrimaryBorder};
    border-radius: 50%;
    opacity: 0.14;
    pointer-events: none;
  `,
  orb: css`
    position: absolute;
    right: -42px;
    bottom: -58px;
    width: 150px;
    height: 150px;
    border-radius: 50%;
    background: ${token.colorSuccessBgHover};
    opacity: 0.42;
    pointer-events: none;
  `,
  grid: css`
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.9fr);
    gap: 22px;
    padding: 20px 22px;

    @media (max-width: ${token.screenLG - 1}px) {
      grid-template-columns: minmax(0, 1fr);
      gap: 16px;
    }

    @media (max-width: ${token.screenMD}px) {
      padding: 18px 16px;
    }
  `,
  identity: css`
    display: flex;
    min-width: 0;
    align-items: flex-start;
    gap: 13px;
  `,
  icon: css`
    display: grid;
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
    place-items: center;
    border: 1px solid ${token.colorPrimaryBorder};
    border-radius: ${token.borderRadiusLG}px;
    color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
    box-shadow: ${token.boxShadowTertiary};
  `,
  copy: css`
    min-width: 0;
    flex: 1;
  `,
  eyebrow: css`
    display: block;
    margin-bottom: 3px;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
    font-weight: 600;
    letter-spacing: 0.04em;
  `,
  title: css`
    display: block;
    overflow: hidden;
    color: ${token.colorText};
    font-size: ${token.fontSizeHeading4}px;
    line-height: 1.35;
    text-overflow: ellipsis;
  `,
  meta: css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 7px 10px;
    margin-top: 7px;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;

    .ant-tag {
      margin-inline-end: 0;
    }
  `,
  metaRent: css`
    color: ${token.colorText};
    font-weight: 600;
  `,
  selector: css`
    margin-top: 14px;
  `,
  outcome: css`
    min-width: 0;
    padding-inline-start: 22px;
    border-inline-start: 1px solid ${token.colorBorderSecondary};

    @media (max-width: ${token.screenLG - 1}px) {
      padding-top: 16px;
      padding-inline-start: 0;
      border-top: 1px solid ${token.colorBorderSecondary};
      border-inline-start: 0;
    }
  `,
  outcomeTitle: css`
    display: block;
    color: ${token.colorText};
    font-weight: 700;
  `,
  statusRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;

    .ant-tag {
      margin-inline-end: 0;
      border-radius: ${token.borderRadiusSM}px;
    }
  `,
  outcomeNote: css`
    display: block;
    margin-top: 9px;
    font-size: ${token.fontSizeSM}px;
    line-height: 1.6;
  `,
}));

const DealSigningHero: React.FC<DealSigningHeroProps> = ({
  displayName,
  house,
  houseId,
  loading,
  selector,
}) => {
  const { styles } = useStyles();

  return (
    <section
      aria-labelledby="deal-signing-house-summary-title"
      className={styles.hero}
      data-testid="deal-signing-house-summary"
    >
      <span className={styles.glow} aria-hidden="true" />
      <span className={styles.orb} aria-hidden="true" />
      <div className={styles.grid}>
        <div>
          <div className={styles.identity}>
            <div className={styles.icon} aria-hidden="true">
              <AppIcon name="house" width={25} height={25} />
            </div>
            <div className={styles.copy}>
              <Typography.Text className={styles.eyebrow}>
                本次成交房源
              </Typography.Text>
              {loading && !house ? (
                <Skeleton.Input active size="small" />
              ) : (
                <Typography.Text
                  id="deal-signing-house-summary-title"
                  strong
                  className={styles.title}
                >
                  {house ? (
                    <HousePreview id={house.id}>{displayName}</HousePreview>
                  ) : (
                    displayName
                  )}
                </Typography.Text>
              )}
              <div className={styles.meta}>
                <span>
                  {house
                    ? housePrimaryLayoutText(house)
                    : '选择后自动带入挂牌信息'}
                </span>
                <span>
                  挂牌月租{' '}
                  <span className={styles.metaRent}>
                    {house ? `${moneyText(house.asking_rent)} / 月` : '-'}
                  </span>
                </span>
                {house?.status ? (
                  <AppStatusTag name="house" state={house.status}>
                    {enumMapping(house.status, house.status__mapping)}
                  </AppStatusTag>
                ) : null}
              </div>
            </div>
          </div>
          {selector ? <div className={styles.selector}>{selector}</div> : null}
        </div>

        <div className={styles.outcome}>
          <Typography.Text className={styles.outcomeTitle}>
            提交后立即完成
          </Typography.Text>
          <div className={styles.statusRow}>
            <AppStatusTag name="lease" state="active">
              租约生效
            </AppStatusTag>
            <AppStatusTag name="house" state={HOUSE_STATUS.RENTED}>
              房态已出租
            </AppStatusTag>
            <AppStatusTag name="allocation-request" state="pending">
              收益待审核
            </AppStatusTag>
          </div>
          <Typography.Text type="secondary" className={styles.outcomeNote}>
            {houseId || house
              ? '一次提交完成业务联动，不需要额外确认；收益审核通过后计入员工流水。'
              : '选择房源后即可继续填写，成交结果由后台事务一次完成。'}
          </Typography.Text>
        </div>
      </div>
    </section>
  );
};

export default DealSigningHero;
