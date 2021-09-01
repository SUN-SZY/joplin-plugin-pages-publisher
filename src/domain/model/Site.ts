import type { Article } from './Article';
import { DEFAULT_THEME_NAME } from './Theme';

export interface Site {
  themeName: string;
  RSSMode: 'full' | 'digest' | 'none';
  RSSLength: number;
  generatedAt?: number;
  articles?: Article[];
}

export const defaultSite: Site = {
  themeName: DEFAULT_THEME_NAME,
  RSSMode: 'none',
  RSSLength: 10,
};
