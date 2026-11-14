import type { Bookmark } from './types'
import { hashId } from './importers/helpers'

export function createSampleBookmarks(): Bookmark[] {
  const now = new Date().toISOString()
  const samples: Omit<Bookmark, 'id' | 'importedAt'>[] = [
    {
      platform: 'x',
      url: 'https://x.com/levelsio/status/1234567890123456789',
      title: 'Ship in public. Build ugly first.',
      author: '@levelsio',
      text: 'Ship in public. Build ugly first. Perfect is the enemy of done.',
      savedAt: '2025-11-02T09:14:00.000Z',
      tags: ['building', 'sample'],
      sourceFile: 'sample',
    },
    {
      platform: 'x',
      url: 'https://x.com/paulg/status/1234567890123456790',
      title: 'The best founders are relentlessly resourceful.',
      author: '@paulg',
      text: 'The best founders are relentlessly resourceful.',
      savedAt: '2025-10-18T16:40:00.000Z',
      tags: ['founders', 'sample'],
      sourceFile: 'sample',
    },
    {
      platform: 'instagram',
      url: 'https://www.instagram.com/p/ABC123sample/',
      title: 'studio.north',
      author: 'studio.north',
      text: 'Morning light study — concrete, linen, quiet green.',
      savedAt: '2025-09-28T08:05:00.000Z',
      tags: ['design', 'sample'],
      sourceFile: 'sample',
    },
    {
      platform: 'instagram',
      url: 'https://www.instagram.com/reel/DEF456sample/',
      title: 'kitchen.notes',
      author: 'kitchen.notes',
      text: 'One-pan lemon chicken — 25 min weeknight recipe.',
      savedAt: '2025-08-12T19:22:00.000Z',
      tags: ['recipes', 'sample'],
      sourceFile: 'sample',
    },
    {
      platform: 'facebook',
      url: 'https://www.facebook.com/save/sample-event-1',
      title: 'Design markets weekend — Amsterdam',
      author: '',
      text: 'Independent makers, print, ceramics. Westergas, zaterdag.',
      savedAt: '2025-07-03T11:00:00.000Z',
      tags: ['events', 'sample'],
      sourceFile: 'sample',
    },
    {
      platform: 'facebook',
      url: 'https://www.facebook.com/save/sample-article-2',
      title: 'How local libraries reinvented discovery',
      author: '',
      text: 'Saved article about physical browsing and serendipity.',
      savedAt: '2025-06-20T14:33:00.000Z',
      tags: ['reading', 'sample'],
      sourceFile: 'sample',
    },
  ]

  return samples.map((s) => ({
    ...s,
    id: hashId([s.platform, s.url, s.title]),
    importedAt: now,
  }))
}

/** Minimal JSON the user can download as a template for manual imports */
export const unifiedTemplate = {
  items: [
    {
      platform: 'x',
      url: 'https://x.com/example/status/1',
      title: 'Voorbeeld bookmark',
      author: '@example',
      text: 'Plak hier de tekst van de post.',
      savedAt: '2025-01-15T12:00:00.000Z',
      tags: ['voorbeeld'],
    },
  ],
}
