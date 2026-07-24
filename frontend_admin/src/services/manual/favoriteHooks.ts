import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { FavoriteItem, FavoritePage } from './favorites';
import {
  getMyFavorites,
  putFavorite,
  removeFavorite,
} from './favorites';

type FavoriteListParams = {
  page: number;
  page_size: number;
  target_type?: string;
  target_id?: string | number;
};

export const favoriteKeys = {
  all: ['favorite'] as const,
  types: () => [...favoriteKeys.all, 'type'] as const,
  lists: () => [...favoriteKeys.all, 'list'] as const,
  list: (params: FavoriteListParams) =>
    [
      ...favoriteKeys.lists(),
      {
        ...params,
        target_id:
          params.target_id == null ? undefined : String(params.target_id),
      },
    ] as const,
  targets: () => [...favoriteKeys.all, 'target'] as const,
  target: (targetType: string, targetId: string | number) =>
    [...favoriteKeys.targets(), targetType, String(targetId)] as const,
};

export function useFavoriteState(
  targetType: string,
  targetId: string | number,
  options?: { enabled?: boolean },
) {
  const normalizedTargetId = String(targetId);
  const query = useQuery({
    queryKey: favoriteKeys.target(targetType, normalizedTargetId),
    queryFn: () =>
      getMyFavorites({
        target_type: targetType,
        target_id: normalizedTargetId,
        page: 1,
        page_size: 1,
      }),
    enabled:
      options?.enabled !== false &&
      Boolean(targetType && normalizedTargetId && normalizedTargetId !== 'NaN'),
  });

  return {
    ...query,
    favorite: query.data?.items[0] || null,
    isFavorite: Boolean(query.data?.items.length),
  };
}

type ToggleFavoriteResult = {
  favorite: FavoriteItem | null;
  isFavorite: boolean;
};

type ToggleFavoriteOptions = {
  onSuccess?: (result: ToggleFavoriteResult, wasFavorite: boolean) => void;
  onError?: (error: Error, wasFavorite: boolean) => void;
};

export function useToggleFavorite(
  targetType: string,
  targetId: string | number,
  options?: ToggleFavoriteOptions,
) {
  const queryClient = useQueryClient();
  const normalizedTargetId = String(targetId);
  const targetQueryKey = favoriteKeys.target(
    targetType,
    normalizedTargetId,
  );

  return useMutation({
    mutationFn: async (wasFavorite: boolean): Promise<ToggleFavoriteResult> => {
      if (wasFavorite) {
        await removeFavorite(targetType, normalizedTargetId);
        return { favorite: null, isFavorite: false };
      }

      const favorite = await putFavorite(targetType, normalizedTargetId);
      return { favorite, isFavorite: true };
    },
    onSuccess: async (result, wasFavorite) => {
      const items = result.favorite ? [result.favorite] : [];
      queryClient.setQueryData<FavoritePage>(targetQueryKey, {
        items,
        total: items.length,
        page: 1,
        page_size: 1,
      });
      options?.onSuccess?.(result, wasFavorite);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: favoriteKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: favoriteKeys.types() }),
      ]);
    },
    onError: (error, wasFavorite) => {
      options?.onError?.(error, wasFavorite);
    },
  });
}
