import { ref, computed, InjectionKey, reactive } from 'vue';
import { filter, pull, negate, map, uniq, findIndex } from 'lodash';
import { singleton } from 'tsyringe';
import type { File } from '../model/JoplinData';
import type { Article } from '../model/Article';
import { JoplinDataRepository } from '../repository/JoplinDataRepository';
import { PluginDataRepository } from '../repository/PluginDataRepository';

export const token: InjectionKey<ArticleService> = Symbol('articleService');

@singleton()
export class ArticleService {
  readonly articles = reactive<Article[]>([]);
  readonly selectedArticles = ref<Article[]>([]);
  private readonly joplinDataRepository = new JoplinDataRepository();
  private readonly pluginDataRepository = new PluginDataRepository();

  readonly unpublishedArticles = computed(() => {
    return filter(this.articles, { published: false });
  });
  readonly publishedArticles = computed(() => {
    return filter(this.articles, { published: true });
  });
  constructor() {
    this.init();
  }

  get allTags() {
    return uniq(map(this.publishedArticles.value, 'tags').flat());
  }

  private async init() {
    const articles = await this.pluginDataRepository.getArticles();

    if (articles) {
      const contents = await Promise.all(
        articles.map(({ noteId }) => this.joplinDataRepository.getNoteContentOf(noteId)),
      );

      for (let i = 0; i < contents.length; i++) {
        articles[i].noteContent = contents[i];
      }
    }

    this.articles.push(...(articles ?? []));
  }

  saveArticles() {
    return this.pluginDataRepository.saveArticles(this.articles);
  }

  async loadArticle(article: Article) {
    const [files, noteContent] = await Promise.all([
      this.joplinDataRepository.getFilesOf(article.noteId),
      this.joplinDataRepository.getNoteContentOf(article.noteId),
    ]);

    const isImage = ({ contentType }: File) => {
      return contentType.startsWith('image');
    };

    article.images = files.filter(isImage);
    article.attachments = files.filter(negate(isImage));
    article.noteContent = noteContent;
    article.content = article.content ?? noteContent;
  }

  async removeArticles() {
    pull(this.articles, ...this.selectedArticles.value);
    this.selectedArticles.value = [];
    await this.saveArticles();
  }

  async togglePublished(status: 'published' | 'unpublished') {
    const articles: Article[] = [];

    for (const article of this.selectedArticles.value) {
      if (status === 'published' ? !article.published : article.published) {
        article.published = status === 'published' ? true : false;
        articles.push(article);
      }
    }

    pull(this.selectedArticles.value, ...articles);
    await this.saveArticles();
  }

  toggleArticleSelected(article: Article) {
    if (this.selectedArticles.value.includes(article)) {
      pull(this.selectedArticles.value, article);
    } else {
      this.selectedArticles.value.push(article);
    }
  }

  selectAll(status: 'published' | 'unpublished') {
    const articles =
      status === 'published' ? this.publishedArticles.value : this.unpublishedArticles.value;

    this.selectedArticles.value = uniq(this.selectedArticles.value.concat(articles));
  }

  saveArticle(article: Partial<Article>) {
    if (!article.noteId) {
      throw new Error('no article noteId when saving');
    }

    const index = findIndex(this.articles, { noteId: article.noteId });

    if (!this.articles[index]) {
      throw new Error('no article when saving');
    }

    Object.assign(this.articles[index], article);
    return this.saveArticles();
  }

  isValidUrl(newUrl: string, noteId?: unknown) {
    for (const article of this.articles) {
      if (article.noteId !== noteId && article.url === newUrl) {
        return false;
      }
    }

    return true;
  }

  updateArticleContent(article: Article) {
    if (article.noteContent === undefined) {
      throw new Error('no noteContent when updating');
    }

    article.content = article.noteContent;
    article.updatedAt = Date.now();
  }

  getValidUrl(baseUrl: string) {
    let url = baseUrl;
    let index = 1;

    while (!this.isValidUrl(url)) {
      url = `${baseUrl}-${index}`;
      index++;
    }

    return url;
  }
}
