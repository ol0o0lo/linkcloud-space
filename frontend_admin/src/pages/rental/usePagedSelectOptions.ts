import { useInfiniteQuery } from '@tanstack/react-query';
import type { ReactNode, UIEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { PageResult } from '@/services/manual/house';

const SELECT_PAGE_SIZE = 20;
const SELECT_SEARCH_DEBOUNCE_MS = 300;
const LOAD_MORE_THRESHOLD = 32;
const EMPTY_PINNED_ITEMS: never[] = [];
const EMPTY_SELECTED_IDS: never[] = [];

type QueryParams = {
  keyword?: string;
  page: number;
  page_size: number;
};

type UsePagedSelectOptions<T extends { id: number }> = {
  enabled: boolean;
  getOptionLabel?: (item: T) => ReactNode;
  getSelectedFallbackLabel?: (id: number) => ReactNode;
  pinnedItems?: Array<T | null | undefined>;
  queryKey: readonly unknown[];
  queryFn: (params: QueryParams) => Promise<PageResult<T>>;
  selectedIds?: Array<number | null | undefined>;
};

export function buildSelectedFirstOptions<T extends { id: number }>({
  getOptionLabel,
  getSelectedFallbackLabel,
  items,
  selectedIds,
}: {
  getOptionLabel: (item: T) => ReactNode;
  getSelectedFallbackLabel?: (id: number) => ReactNode;
  items: T[];
  selectedIds: number[];
}) {
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const selectedIdSet = new Set(selectedIds);
  return [
    ...selectedIds.map((id) => {
      const item = itemMap.get(id);
      return {
        value: id,
        label: item
          ? getOptionLabel(item)
          : (getSelectedFallbackLabel?.(id) ?? `#${id}`),
      };
    }),
    ...items
      .filter((item) => !selectedIdSet.has(item.id))
      .map((item) => ({
        value: item.id,
        label: getOptionLabel(item),
      })),
  ];
}

function useDebouncedText(value: string) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedValue(value.trim()),
      SELECT_SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [value]);

  return debouncedValue;
}

export function usePagedSelectOptions<T extends { id: number }>({
  enabled,
  getOptionLabel,
  getSelectedFallbackLabel,
  pinnedItems = EMPTY_PINNED_ITEMS,
  queryKey,
  queryFn,
  selectedIds = EMPTY_SELECTED_IDS,
}: UsePagedSelectOptions<T>) {
  const [searchText, setSearchText] = useState('');
  const keyword = useDebouncedText(searchText);
  const query = useInfiniteQuery({
    queryKey: [...queryKey, keyword],
    queryFn: ({ pageParam }) =>
      queryFn({
        page: pageParam,
        page_size: SELECT_PAGE_SIZE,
        ...(keyword ? { keyword } : {}),
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.page_size < lastPage.total
        ? lastPage.page + 1
        : undefined,
    enabled,
  });

  useEffect(() => {
    if (!enabled) setSearchText('');
  }, [enabled]);

  const normalizedSelectedIds = useMemo(() => {
    const seen = new Set<number>();
    return selectedIds.filter((id): id is number => {
      if (typeof id !== 'number' || !Number.isFinite(id) || seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });
  }, [selectedIds]);

  const items = useMemo(() => {
    const itemMap = new Map<number, T>();
    pinnedItems.forEach((item) => {
      if (item) itemMap.set(item.id, item);
    });
    query.data?.pages.forEach((page) => {
      page.items.forEach((item) => {
        itemMap.set(item.id, item);
      });
    });
    const selectedIdSet = new Set(normalizedSelectedIds);
    return [
      ...normalizedSelectedIds.flatMap((id) => {
        const item = itemMap.get(id);
        return item ? [item] : [];
      }),
      ...[...itemMap.values()].filter((item) => !selectedIdSet.has(item.id)),
    ];
  }, [normalizedSelectedIds, pinnedItems, query.data?.pages]);

  const options = useMemo(() => {
    if (!getOptionLabel) return [];
    return buildSelectedFirstOptions({
      getOptionLabel,
      getSelectedFallbackLabel,
      items,
      selectedIds: normalizedSelectedIds,
    });
  }, [getOptionLabel, getSelectedFallbackLabel, items, normalizedSelectedIds]);

  const onPopupScroll = (event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const isNearBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight <=
      LOAD_MORE_THRESHOLD;
    if (isNearBottom && query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  };

  return {
    isError: query.isError,
    items,
    loading: query.isFetching,
    notFoundContent: query.isFetching ? '搜索中…' : '未找到匹配项',
    onOpenChange: (open: boolean) => {
      if (!open) setSearchText('');
    },
    onPopupScroll,
    options,
    refetch: query.refetch,
    showSearch: {
      filterOption: false as const,
      onSearch: setSearchText,
    },
  };
}
