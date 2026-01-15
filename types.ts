export enum CategoryId {
  Speech = 'speech',
  Politics = 'politics',
  Common = 'common',
  Logic = 'logic',
  Data = 'data',
}

export const CategoryMeta = {
  [CategoryId.Speech]: { label: '言语理解', icon: 'BookOpen', color: 'text-stone-600' },
  [CategoryId.Politics]: { label: '政治判断', icon: 'Scale', color: 'text-stone-600' },
  [CategoryId.Common]: { label: '常识判断', icon: 'Lightbulb', color: 'text-stone-600' },
  [CategoryId.Logic]: { label: '逻辑推理', icon: 'BrainCircuit', color: 'text-stone-600' },
  [CategoryId.Data]: { label: '资料分析', icon: 'BarChart3', color: 'text-stone-600' },
};

export interface QuestionRecord {
  total: number;
  correct: number;
  duration: number; // Duration in minutes
}

export interface DailyLog {
  id: string; // Unique ID for every session
  date: string; // ISO Date String YYYY-MM-DD
  categories: Record<CategoryId, QuestionRecord>;
  timestamp: number;
}

export interface ExamTarget {
  id: string;
  name: string;
  examDate: string; // ISO Date String
  color: string; // Hex or Tailwind class
  createdAt: number;
}

export interface ReviewNote {
  id: string;
  date: string; // ISO Date String YYYY-MM-DD HH:mm:ss
  content: string;
  targetId: string;
  timestamp: number;
}

export type AppState = {
  targets: ExamTarget[];
  selectedTargetId: string | null;
  logs: Record<string, DailyLog[]>; // Keyed by target ID
  reviews: Record<string, ReviewNote[]>; // Keyed by target ID
};