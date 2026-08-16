import { Empty, Space, Typography } from 'antd';
import React from 'react';

type QueryLike = {
  isFetched?: boolean;
  isFetching?: boolean;
  isLoading?: boolean;
  fetchStatus?: 'fetching' | 'idle' | 'paused';
};

export function isInitialQueryPending(query?: QueryLike | null) {
  if (!query) return false;
  if (query.isFetched) return false;
  return query.isLoading || query.isFetching || query.fetchStatus === 'fetching' || query.fetchStatus === 'idle';
}

export function isAnyInitialQueryPending(queries: Array<QueryLike | null | undefined>) {
  return queries.some((query) => isInitialQueryPending(query));
}

export function getLoadingSafeCount(value: number, loading: boolean) {
  return loading ? '-' : value;
}

export function getLoadingSafeText(value: string, loadingText: string, loading: boolean) {
  return loading ? loadingText : value;
}

export function getLoadingAwareEmptyState(options: {
  loading: boolean;
  loadingTitle: string;
  loadingDescription: string;
  emptyState: React.ReactNode;
}) {
  const { loading, loadingTitle, loadingDescription, emptyState } = options;
  if (!loading) return emptyState;
  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={(
        <Space orientation="vertical" size={4}>
          <Typography.Text strong>{loadingTitle}</Typography.Text>
          <Typography.Text type="secondary">{loadingDescription}</Typography.Text>
        </Space>
      )}
    />
  );
}
