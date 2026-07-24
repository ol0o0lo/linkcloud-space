import { request } from '@umijs/max';

export type FavoriteMediaRef = {
  media_id: number;
  media_type: string;
  label?: string;
  image_role?: string;
  url?: string;
  thumbnail?: string | null;
};

export type FavoriteHouseTarget = {
  id: number;
  room_number: string;
  floor?: number | null;
  area?: string | number | null;
  asking_rent?: string | number | null;
  bedrooms?: number | null;
  living_rooms?: number | null;
  public_description?: string;
  images?: FavoriteMediaRef[];
  tags?: string[];
  effective_tags?: string[];
  building: {
    id: number;
    name: string;
    address: string;
    estate?: {
      id: number;
      name: string;
      display_name: string;
      province: string;
      city: string;
      district: string;
      address: string;
    } | null;
  };
  publisher: {
    slug: string;
    name: string;
    description: string;
  };
};

export type FavoriteBuildingTarget = {
  id: number;
  name: string;
  address: string;
  lat?: string | number | null;
  lng?: string | number | null;
  floors: number;
  elevator: boolean;
  images?: FavoriteMediaRef[];
  tags?: string[];
  estate?: {
    id: number;
    name: string;
    display_name: string;
    province: string;
    city: string;
    district: string;
    address: string;
  } | null;
  publisher: {
    slug: string;
    name: string;
    description: string;
  };
};

export type FavoriteEstateTarget = {
  id: number;
  name: string;
  display_name: string;
  province: string;
  city: string;
  district: string;
  address: string;
  lat?: string | number | null;
  lng?: string | number | null;
  images?: FavoriteMediaRef[];
  description?: string;
  publisher: {
    slug: string;
    name: string;
    description: string;
  };
};

export type FavoriteDisplayFact = {
  label: string;
  value: string;
};

export type FavoriteDisplay = {
  title: string;
  subtitle: string;
  cover_url?: string | null;
  description?: string | null;
  tags?: string[];
  facts?: FavoriteDisplayFact[];
};

export type FavoriteTargetType = {
  target_type: string;
  display_name: string;
  order: number;
  favorite_count: number;
};

export type FavoriteItem = {
  id: number;
  target_type: string;
  target_id: string;
  created_at: string;
  available: boolean;
  display?: FavoriteDisplay | null;
  target:
    | FavoriteHouseTarget
    | FavoriteBuildingTarget
    | FavoriteEstateTarget
    | Record<string, unknown>
    | null;
};

export type FavoritePage = {
  items: FavoriteItem[];
  total: number;
  page: number;
  page_size: number;
};

export function getFavoriteTypes() {
  return request<FavoriteTargetType[]>('/api/users/me/favorite/type/', {
    method: 'GET',
  });
}

export function getMyFavorites(params: {
  page?: number;
  page_size?: number;
  target_type?: string;
  target_id?: string | number;
}) {
  return request<FavoritePage>('/api/users/me/favorite/', {
    method: 'GET',
    params,
  });
}

export function putFavorite(targetType: string, targetId: string | number) {
  return request<FavoriteItem>('/api/users/me/favorite/', {
    method: 'PUT',
    params: { target_type: targetType, target_id: targetId },
  });
}

export function removeFavorite(targetType: string, targetId: string | number) {
  return request<{ success: boolean }>('/api/users/me/favorite/', {
    method: 'DELETE',
    params: { target_type: targetType, target_id: targetId },
  });
}
