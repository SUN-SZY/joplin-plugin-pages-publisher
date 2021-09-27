import { Site } from 'domain/model/Site';
import { Article } from 'domain/model/Article';
import type _ from 'lodash';
import type moment from 'moment';

// copy from @joplin/renderer
export interface RenderResultPluginAsset {
  name: string;
  mime: string;
  path: string;
  pathIsAbsolute: boolean;
}

interface ResourceInfo {
  localState: { fetch_status: number };
  extension: string;
  item: { mime: string; id: string; encryption_blob_encrypted: number; encryption_applied: number };
}
export type ResourceMap = Record<string, ResourceInfo | undefined>;

export type ArticleForPage = Article & {
  htmlContent: string;
  fullUrl: string;
};

export interface PageEnv {
  $page: Record<string, unknown>;
  $site: {
    articles: ArticleForPage[];
    generatedAt: Required<Site>['generatedAt'];
    rss: string;
    [index: string]: unknown;
  };
  $article?: ArticleForPage;
  _: typeof _;
  moment: typeof moment;
}
