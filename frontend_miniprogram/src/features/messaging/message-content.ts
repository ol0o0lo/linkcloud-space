import type { FavoriteOut } from '@/features/favorites/service'
import { buildFavoriteHouseCardModel, buildHouseCardModel } from '../../domain/house-card.ts'
import { getHouseDisplayMedia } from '../../domain/house-media.ts'
import { formatHouseLayout } from '../../domain/house.ts'

export interface MessageMedia {
  media_id?: number
  url?: string | null
  thumbnail?: string | null
}

export interface ContactCardPayload {
  house_id: number
  phone: string
  wechat: string
}

export interface HouseCardPayload {
  house_id: number
  title: string
  bedrooms: number | null
  living_rooms: number | null
  area: string | null
  asking_rent: string | null
  address: string
  cover_url?: string
}

export interface MessageContentSource {
  content: string
  message_type?: string
  payload?: unknown
  media?: MessageMedia[]
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function positiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function numberText(value: unknown): string | null {
  return (typeof value === 'number' || typeof value === 'string') && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? String(value) : null
}

export function contactCardPayload(message: MessageContentSource): ContactCardPayload | null {
  const value = object(message.payload)
  if (message.message_type !== 'house.contact' || !value || !positiveId(value.house_id))
    return null
  const phone = typeof value.phone === 'string' && /^\+?[\d ()-]{7,32}$/.test(value.phone) ? value.phone : ''
  const wechat = typeof value.wechat === 'string' && value.wechat.length <= 64 ? value.wechat : ''
  return phone || wechat ? { house_id: value.house_id, phone, wechat } : null
}

export function houseCardPayload(message: MessageContentSource): HouseCardPayload | null {
  const value = object(message.payload)
  if (message.message_type !== 'house.listing' || !value || !positiveId(value.house_id) || typeof value.title !== 'string' || !value.title.trim())
    return null
  return {
    house_id: value.house_id,
    title: value.title,
    bedrooms: typeof value.bedrooms === 'number' && Number.isInteger(value.bedrooms) && value.bedrooms >= 0 ? value.bedrooms : null,
    living_rooms: typeof value.living_rooms === 'number' && Number.isInteger(value.living_rooms) && value.living_rooms >= 0 ? value.living_rooms : null,
    area: numberText(value.area),
    asking_rent: numberText(value.asking_rent),
    address: typeof value.address === 'string' ? value.address : '',
    ...(typeof value.cover_url === 'string' && /^https?:\/\//.test(value.cover_url) ? { cover_url: value.cover_url } : {}),
  }
}

export function houseMessageCard(payload: HouseCardPayload, media: MessageMedia[] = []) {
  const card = buildHouseCardModel({
    id: payload.house_id,
    room_number: '',
    building: { name: payload.title, address: payload.address },
    bedrooms: payload.bedrooms,
    living_rooms: payload.living_rooms,
    area: payload.area,
    asking_rent: payload.asking_rent,
    images: media.length ? media.map(item => ({ url: item.url, thumbnail: item.thumbnail })) : payload.cover_url ? [{ url: payload.cover_url }] : [],
  })
  return {
    ...card,
    facts: [formatHouseLayout(payload.bedrooms, payload.living_rooms), payload.area == null ? '' : `${Number(payload.area).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}㎡`].filter(Boolean).join(' · '),
  }
}

export function favoriteHouseMessage(favorite: FavoriteOut): { payload: HouseCardPayload, media: MessageMedia[] } | null {
  const id = Number(favorite.target_id)
  if (!favorite.available || favorite.target_type !== 'house' || !positiveId(id))
    return null
  const card = buildFavoriteHouseCardModel(favorite)
  const target = object(favorite.target) || {}
  const payload = houseCardPayload({ message_type: 'house.listing', content: '', payload: { ...target, house_id: id, title: card.title, address: card.location } })
  if (!payload)
    return null
  const media = getHouseDisplayMedia({ images: Array.isArray(target.images) ? target.images : [], migration_media: target.migration_media }, 'image')
    .map(item => ({ url: typeof item.url === 'string' ? item.url : null, thumbnail: typeof item.thumbnail === 'string' ? item.thumbnail : null }))
  if (!media.length && card.coverUrl)
    media.push({ url: card.coverUrl, thumbnail: card.coverUrl })
  return { payload, media: media.slice(0, 1) }
}
