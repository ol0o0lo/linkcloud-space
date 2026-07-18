import { Alert, Button, Skeleton } from 'antd';
import type { EntityPreviewVariant } from './types';

interface EntityPreviewSkeletonProps {
  variant: EntityPreviewVariant;
  withMedia?: boolean;
}

export function EntityPreviewSkeleton({
  variant,
  withMedia = false,
}: EntityPreviewSkeletonProps) {
  if (variant === 'drawer') {
    return (
      <div aria-label="正在加载预览" role="status" style={{ width: 320 }}>
        <Skeleton active paragraph={{ rows: 4 }} title />
      </div>
    );
  }

  return (
    <div
      aria-label="正在加载预览"
      role="status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        width: '100%',
      }}
    >
      {withMedia ? (
        <div
          aria-hidden
          data-testid="entity-preview-skeleton-media"
          style={{
            background:
              'linear-gradient(145deg, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.08))',
            flex: '0 0 124px',
            height: 124,
          }}
        />
      ) : null}
      <div style={{ padding: 12 }}>
        <Skeleton active paragraph={{ rows: 4 }} title />
      </div>
    </div>
  );
}

interface EntityPreviewErrorProps {
  error: unknown;
  onRetry: () => void;
}

function getErrorStatus(error: unknown): number | string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as {
    response?: { status?: number | string };
    status?: number | string;
    info?: { code?: number | string };
  };
  return candidate.response?.status ?? candidate.status ?? candidate.info?.code;
}

export function EntityPreviewError({
  error,
  onRetry,
}: EntityPreviewErrorProps) {
  const status = Number(getErrorStatus(error));

  if (status === 403) {
    return <Alert title="暂无权限查看详情" type="warning" />;
  }

  if (status === 404) {
    return <Alert title="该记录已不存在" type="warning" />;
  }

  return (
    <Alert
      action={<Button onClick={onRetry}>重新加载</Button>}
      title="详情加载失败"
      type="error"
    />
  );
}
