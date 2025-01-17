import joplinApi from 'api';
import { SettingItemType, ViewHandle } from 'api/types';
import type JoplinViewsPanels from 'api/JoplinViewsPanels';
import type JoplinViewsDialogs from 'api/JoplinViewsDialogs';
import { container } from 'tsyringe';
import { isNumber } from 'lodash';

import type { JoplinGetParams } from 'domain/service/AppService';
import { Db } from 'driver/db/joplinPlugin';
import webviewBridge from 'driver/webview/webviewBridge';

const OPEN_PAGES_PUBLISHER_COMMAND = 'openPagesPublisher';
const db = container.resolve(Db);
enum UIType {
  Dialog,
  Panel,
}

interface JoplinResponse<T> {
  items: T[];
  has_more: boolean;
}

const UI_TYPE_SETTING = 'uiType';
const UI_SIZE_SETTING = 'uiSize';
const DEFAULT_UI_SIZE = '600*640';
const isValidUISize = (size: unknown): size is [number, number] =>
  Array.isArray(size) && size.length === 2 && size.every(isNumber);

const IS_NEW_USER_SETTING = 'isNewUser';

export function fetchData<T>(...args: JoplinGetParams) {
  return joplinApi.data.get(...args) as Promise<T>;
}

export async function fetchAllData<T>(...[path, query]: JoplinGetParams) {
  let result: T[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const { items, has_more } = await fetchData<JoplinResponse<T>>(path, {
      ...query,
      page: page++,
    });

    result = result.concat(items);
    hasMore = has_more;
  }

  return result;
}

export default class Joplin {
  private windowHandler?: ViewHandle;
  private uiType?: UIType;

  fetchData(...args: JoplinGetParams) {
    return fetchData(...args);
  }

  fetchAllData(...args: JoplinGetParams) {
    return fetchAllData(...args);
  }

  get ui() {
    if (this.uiType === undefined) {
      throw new Error('no ui type');
    }

    return {
      [UIType.Dialog]: joplinApi.views.dialogs,
      [UIType.Panel]: joplinApi.views.panels,
    }[this.uiType];
  }

  async setupSettings() {
    const SECTION_NAME = 'github';

    await joplinApi.settings.registerSection(SECTION_NAME, {
      label: 'Pages Publisher',
    });

    await joplinApi.settings.registerSettings({
      githubToken: {
        label: 'Github Token',
        secure: true,
        type: SettingItemType.String,
        public: true,
        value: '',
        section: SECTION_NAME,
        description:
          '"public_repo" scope is required. See https://docs.github.com/en/github/authenticating-to-github/keeping-your-account-and-data-secure/creating-a-personal-access-token for details',
      },
      [UI_TYPE_SETTING]: {
        label: 'UI Type',
        type: SettingItemType.Int,
        public: true,
        value: UIType.Panel,
        isEnum: true,
        options: {
          [UIType.Dialog]: 'Dialog',
          [UIType.Panel]: 'Panel',
        },
        section: SECTION_NAME,
        description:
          "Use Dialog or Panel to display this plugin's UI(need to restart Joplin to take effect).",
      },
      [UI_SIZE_SETTING]: {
        label: 'UI Size',
        type: SettingItemType.String,
        public: true,
        value: DEFAULT_UI_SIZE,
        section: SECTION_NAME,
        description: 'Size for UI in the dialog. width*height',
      },
      [IS_NEW_USER_SETTING]: {
        public: false,
        value: true,
        type: SettingItemType.Bool,
        label: IS_NEW_USER_SETTING,
      },
    });
  }

  private async openPluginUI() {
    if (!this.windowHandler) {
      this.windowHandler = await this.ui.create('mainWindow');
      // `joplin.views.panels.onMessage`  works for both dialog and panel
      await joplinApi.views.panels.onMessage(this.windowHandler, webviewBridge(this));
      await this.ui.addScript(this.windowHandler, './driver/webview/index.js');
    }

    await db.init(true);

    if (this.isUsingPanel()) {
      await this.ui.show(this.windowHandler);
    }

    if (this.isUsingDialog()) {
      const [width, height] = await this.getWindowSize();
      // prevent dialog modal resizes suddenly
      await this.ui.setHtml(
        this.windowHandler,
        `<style>#joplin-plugin-content {width: ${width}px; height: ${height}px}</style>`,
      );
      await this.ui.setButtons(this.windowHandler, [{ id: 'no', title: 'Quit Pages Publisher' }]);
      this.ui.open(this.windowHandler);
    }
  }

  async getWindowSize() {
    if (!this.isUsingDialog()) {
      return [0, 0] as const;
    }

    const size = (await this.getSettingOf<string>(UI_SIZE_SETTING)).split('*').map(Number);

    return isValidUISize(size)
      ? size
      : (DEFAULT_UI_SIZE.split('*').map(Number) as [number, number]);
  }

  private isUsingDialog(): this is { ui: JoplinViewsDialogs } {
    return this.uiType === UIType.Dialog;
  }

  private isUsingPanel(): this is { ui: JoplinViewsPanels } {
    return this.uiType === UIType.Panel;
  }

  async setupCommand() {
    this.uiType = await this.getSettingOf<UIType>(UI_TYPE_SETTING);

    await joplinApi.commands.register({
      name: OPEN_PAGES_PUBLISHER_COMMAND,
      label: 'Open Pages Publisher',
      execute: this.openPluginUI.bind(this),
    });
  }

  async setupMenu() {
    await joplinApi.views.menuItems.create('pages-publisher', OPEN_PAGES_PUBLISHER_COMMAND);
  }

  async quit() {
    if (!this.windowHandler) {
      throw Error('no windowHandler when quit');
    }

    if (this.isUsingPanel()) {
      // attention: handler still exists after hide/close UI
      await this.ui.hide(this.windowHandler);
    }
  }

  getInstallationDir() {
    return joplinApi.plugins.installationDir();
  }

  getDataDir() {
    return joplinApi.plugins.dataDir();
  }

  getSettingOf<T = unknown>(key: string) {
    return joplinApi.settings.value(key) as Promise<T>;
  }

  openNote(noteId: string) {
    return joplinApi.commands.execute('openNote', noteId);
  }

  isNewUser() {
    return this.getSettingOf<boolean>(IS_NEW_USER_SETTING);
  }

  setAsOldUser() {
    return joplinApi.settings.setValue(IS_NEW_USER_SETTING, false);
  }
}
