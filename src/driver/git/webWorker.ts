/*  eslint-env worker*/
/// <reference lib="WebWorker" />
import http from 'isomorphic-git/http/web';
import { difference } from 'lodash';
import {
  setConfig,
  clone,
  listBranches,
  branch,
  add,
  listFiles,
  remove,
  commit,
  push,
} from 'isomorphic-git';
import { expose, wrap } from 'comlink';

import fs from 'driver/fs/webWorker';
import type { WorkerGit, GitEventHandler } from './type';

const { onMessage, onProgress } = wrap<GitEventHandler>(self);

const workerGit: WorkerGit = {
  async initRepo({ gitInfo, githubInfo }) {
    const { userName, token, branch: branchName = 'master', email } = githubInfo;
    const { dir, gitdir, url, remote } = gitInfo;

    await fs.promises.emptyDir(gitdir);
    await fs.promises.emptyDir(dir);

    await clone({
      fs,
      http,
      dir,
      gitdir,
      url,
      remote,
      depth: 1,
      noCheckout: true,
      onAuth: () => ({ username: userName, password: token }),
      onMessage,
      onProgress,
    });

    const branches = await listBranches({ fs, dir, gitdir });

    if (!branches.includes(branchName)) {
      await branch({ fs, dir, gitdir, ref: branchName });
    }

    await setConfig({ fs, gitdir, path: 'user.name', value: userName });
    await setConfig({ fs, gitdir, path: 'user.email', value: email });
  },
  async publish({ gitInfo: { dir, gitdir, remote, url }, githubInfo, files }) {
    await new Promise((resolve) => setTimeout(resolve, 3000)); // a 3s delay, so user can terminate
    await add({ fs, gitdir, dir, filepath: '.' });

    const filesExisted = await listFiles({ fs, gitdir, dir, ref: githubInfo.branch });
    const files_ = files.map((path) => path.replace(`${dir}/`, ''));
    const deletedFiles = difference(filesExisted, files_);

    for (const deletedFile of deletedFiles) {
      await remove({ fs, dir, gitdir, filepath: deletedFile });
    }

    await commit({ fs, gitdir, message: 'test', ref: githubInfo.branch });
    await push({
      fs,
      http,
      gitdir,
      dir,
      ref: githubInfo.branch,
      remoteRef: githubInfo.branch,
      remote,
      url,
      onAuth: () => ({ username: githubInfo.userName, password: githubInfo.token }),
      onMessage,
      onProgress,
    });
  },
};

expose(workerGit);