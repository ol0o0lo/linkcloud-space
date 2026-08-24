import {
  CheckCircleOutlined,
  FileDoneOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { history } from '@umijs/max';
import { WorkbenchWidgetFrame } from '../../components/WorkbenchWidgetFrame';
import { useSpaceWorkbenchData } from '../../data/SpaceWorkbenchData';
import type { WorkbenchWidgetWidth } from '../../layout/model';
import { useStyles } from '../../styles';

const riskPaths: Record<string, string> = {
  'blocked-publish': '/rental/workbench/overview?view=space&publish=blocked',
  'missing-contact': '/rental/viewings?pending_lease=true&contact_missing=true',
  'ready-lease': '/rental/leases?pending_lease=true',
};

const riskLevelLabels: Record<string, string> = {
  danger: '阻断',
  warning: '提醒',
  info: '关注',
};

export function SpaceRisksWidget({ width }: { width: WorkbenchWidgetWidth }) {
  const { styles } = useStyles();
  const data = useSpaceWorkbenchData();

  return (
    <WorkbenchWidgetFrame
      variant="risks"
      title="关键风险"
      subtitle="优先处理影响发布与签约的阻断项"
      loading={data.overviewLoading}
      error={data.overviewError}
      onRetry={data.retryOverview}
    >
      {data.risks.length ? (
        <div
          className={styles.spaceRiskContent}
          data-wide={width === 2 || undefined}
        >
          <div className={styles.spaceRiskList} data-testid="space-risk-stack">
            {data.risks.map((risk) => (
              <button
                type="button"
                key={risk.key}
                className={styles.spaceRiskItem}
                data-level={risk.level}
                onClick={() => history.push(riskPaths[risk.key])}
              >
                <span className={styles.spaceRiskCount}>{risk.count}</span>
                <span className={styles.spaceRiskCopy}>
                  <strong>{risk.label}</strong>
                  <small>
                    {riskLevelLabels[risk.level] || '关注'} · 查看处理项
                  </small>
                </span>
                <RightOutlined aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className={styles.spaceRiskGuide}>
            <div className={styles.spaceRiskGuideHeading}>
              <span aria-hidden="true">
                <SafetyCertificateOutlined />
              </span>
              <span>
                <strong>建议处理顺序</strong>
                <small>先解除业务阻断，再推进后续流程</small>
              </span>
            </div>
            <div className={styles.spaceRiskGuideSteps}>
              <span>
                <StopOutlined aria-hidden="true" />
                <span>
                  <strong>清理阻断项</strong>
                  <small>优先处理无法发布的房源</small>
                </span>
              </span>
              <span>
                <FileDoneOutlined aria-hidden="true" />
                <span>
                  <strong>补齐关键资料</strong>
                  <small>复核租客、房源和签约信息</small>
                </span>
              </span>
              <span>
                <CheckCircleOutlined aria-hidden="true" />
                <span>
                  <strong>继续成交转签</strong>
                  <small>资料完整后创建并跟进租约</small>
                </span>
              </span>
            </div>
            <button
              type="button"
              className={styles.spaceRiskGuideAction}
              onClick={() => history.push(riskPaths[data.risks[0].key])}
            >
              处理最高优先级
              <RightOutlined aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.widgetCompactEmpty}>
          <span
            className={styles.widgetCompactEmptyIcon}
            data-tone="success"
            aria-hidden="true"
          >
            <SafetyCertificateOutlined />
          </span>
          <span className={styles.widgetCompactEmptyCopy}>
            <strong>暂无关键风险</strong>
            <small>当前发布与签约流程运行正常</small>
          </span>
        </div>
      )}
    </WorkbenchWidgetFrame>
  );
}
