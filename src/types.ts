export type Feature =
  | 'habits'
  | 'reminders'
  | 'focus music'
  | 'notes'
  | 'todo list'
  | 'pomodoro'

export type Command = Feature | 'Search'

export type Side = 'left' | 'main' | 'right'

export type Theme = 'dark' | 'light'

export interface WorkspaceFrame {
  id: string
  feature: Feature
  title: string
  eyebrow: string
  description: string
  details: string[]
}

export interface FeatureMeta {
  glyph: string
  description: string
  frame: Omit<WorkspaceFrame, 'id' | 'feature'>
}
