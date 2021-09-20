import { compact, mapValues, map, filter, isString } from 'lodash';
import { computed, reactive, toRaw } from 'vue';
import type { Theme } from './Theme';

export interface Field {
  readonly name: string;
  readonly label?: string;
  readonly tip?: string;
  readonly placeholder?: string;
  readonly defaultValue?: unknown;
  readonly rules?: Record<string, unknown>[];
  readonly inputType?:
    | 'input'
    | 'select'
    | 'multiple-select'
    | 'textarea'
    | 'radio'
    | 'checkbox'
    | 'date'
    | 'switch'
    | 'markdown'
    | 'number';

  // valid when inputType is select, multiple-select, radio, checkbox
  readonly options?: Array<Readonly<{ label: string; value: string }>>;
}

export const MARKDOWN_CONTENT_PREFIX = 'markdown://';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Vars = Record<string, any>;

// page with these names will be handled in some special ways
export const INDEX_PAGE_NAME = 'index';
export const ARTICLE_PAGE_NAME = 'article';

export const PREDEFINED_FIELDS: Record<string, Field[] | undefined> = {
  [ARTICLE_PAGE_NAME]: [
    {
      name: 'dateFormat',
      label: 'Date Format',
      defaultValue: 'YYYY-MM-DD HH:mm',
      placeholder: 'Default value is YYYY-MM-DD HH:mm.',
      tip: 'See <a href="https://momentjs.com/docs/#/displaying/">moment.js document.</a>',
    },
  ],
};

export class Page {
  readonly fieldVars: Vars; // vars provided by fields, which are defined by theme and this plugin. Comes from persistence layer, can be updated by user via fields

  readonly fields = compact([
    this.name === INDEX_PAGE_NAME
      ? null
      : {
          name: 'url',
          label: 'Url',
          placeholder: `Default value is ${this.name}`,
        },
    ...(PREDEFINED_FIELDS[this.name] || []),
    ...(this.themeConfig.pages[this.name] ?? []),
  ]);

  readonly isArticlePage = this.name === ARTICLE_PAGE_NAME;

  constructor(
    readonly name: string,
    fieldVars: Vars, // vars provided by fields, which are defined by theme and this plugin. Comes from persistence layer, can be updated by user via fields
    private readonly themeConfig: Theme,
  ) {
    this.fieldVars = reactive(
      this.fields.reduce((result, filed) => {
        result[filed.name] = null;
        return result;
      }, {} as Vars),
    );

    this.setValues(fieldVars);
  }

  get markdownFieldNames() {
    return Page.getMarkdownFieldNames(this.fields);
  }

  setValues(values: Vars) {
    Object.assign(
      this.fieldVars,
      mapValues(values, (value, key) => {
        if (this.markdownFieldNames.includes(key) && isString(value)) {
          return Page.trimMarkdownPrefix(value);
        }

        return value;
      }),
    );
  }

  outputValues() {
    return mapValues(this.fieldVars, (value, key) => {
      if (this.markdownFieldNames.includes(key) && isString(value)) {
        return `${MARKDOWN_CONTENT_PREFIX}${value}`;
      }

      return toRaw(value);
    });
  }

  readonly url = computed(() => {
    if (this.name === INDEX_PAGE_NAME) {
      return '/';
    }

    return `/${this.fieldVars.url || this.name}`;
  });

  static getMarkdownFieldNames(field: Field[]) {
    return map(filter(field, { inputType: 'markdown' }), 'name');
  }

  static trimMarkdownPrefix(content: string) {
    return content.replace(new RegExp(`^${MARKDOWN_CONTENT_PREFIX}`, ''), '');
  }
}
