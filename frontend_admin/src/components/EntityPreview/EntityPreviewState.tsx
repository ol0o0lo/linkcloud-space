import { Alert, Button, Skeleton } from 'antd';

export function EntityPreviewSkeleton() {
  return (
    <div style={{ width: 320 }}>
      <Skeleton active paragraph={{ rows: 4 }} title />
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

export function EntityPreviewError({ error, onRetry }: EntityPreviewErrorProps) {
  const status = Number(getErrorStatus(error));

  if (status === 403) {
    return <Alert title="暂无权限查看详情" type="warning" />;
  }

  if (status === 404) {
    return <Alert title="该记录已不存在" type="warning" />;
  }

  return <Alert action={<Button onClick={onRetry}>重新加载</Button>} title="详情加载失败" type="error" />;
}
