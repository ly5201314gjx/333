import { AppState, ExamTarget, DailyLog } from '../types';

const STORAGE_KEY = 'zenstudy_v1';

const DEFAULT_STATE: AppState = {
  targets: [],
  selectedTargetId: null,
  logs: {},
  reviews: {},
};

export const loadState = (): AppState => {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) return DEFAULT_STATE;
    const state = JSON.parse(serialized);
    // Migration for existing data that might lack reviews
    if (!state.reviews) state.reviews = {};
    return state;
  } catch (e) {
    console.error("Failed to load state", e);
    return DEFAULT_STATE;
  }
};

export const saveState = (state: AppState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save state", e);
  }
};

export const generateId = () => Math.random().toString(36).substr(2, 9);