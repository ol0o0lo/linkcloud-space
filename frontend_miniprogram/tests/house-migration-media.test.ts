import assert from 'node:assert/strict'
import test from 'node:test'
import { getHouseDisplayMedia } from '../src/domain/house-media.ts'
import { buildHouseCardModel } from '../src/domain/house-card.ts'

test('房源展示按原顺序合并迁移URL并去重，不修改表单使用的原数组', () => {
  const images = [{ media_id: 10, url: 'https://new.example.com/2.jpg' }]
  const migration_media = [
    { id: '1', field: 'images', position: 0, url: 'https://old.example.com/1.jpg', media_type: 'image', status: 'pending' },
    { id: '2', field: 'images', position: 1, url: images[0].url, media_type: 'image', status: 'succeeded' },
    { id: '3', field: 'images', position: 2, url: null, media_type: 'image', status: 'missing' },
    { id: '4', field: 'videos', position: 0, url: 'https://old.example.com/4.mp4', media_type: 'video', status: 'pending' },
  ]
  const result = getHouseDisplayMedia({ images, migration_media }, 'image')
  assert.deepEqual(result.map(item => item.url), ['https://old.example.com/1.jpg', 'https://new.example.com/2.jpg'])
  assert.deepEqual(images, [{ media_id: 10, url: 'https://new.example.com/2.jpg' }])
  assert.equal(getHouseDisplayMedia({ images, migration_media }, 'video').length, 1)
  const card = buildHouseCardModel({ id: 1, room_number: '101', building: { name: 'A栋' }, images: [], migration_media })
  assert.equal(card.coverUrl, 'https://old.example.com/1.jpg')
  assert.equal(card.imageCount, 2)
})
