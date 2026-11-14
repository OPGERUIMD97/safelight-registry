export type Platform = 'x' | 'instagram' | 'facebook' | 'other'

export interface Bookmark {
  id: string
  platform: Platform
  url: string
  title: string
  author: string
  text: string
  savedAt: string | null
  importedAt: string
  tags: string[]
  sourceFile?: string
}

export interface ImportResult {
  added: number
  skipped: number
  platformGuess: Platform | 'mixed' | 'unknown'
  errors: string[]
}

export type View = 'library' | 'import'
export type PlatformFilter = 'all' | Platform
