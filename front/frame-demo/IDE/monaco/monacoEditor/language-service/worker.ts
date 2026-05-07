import * as monaco from 'monaco-editor';

import Uri = monaco.Uri;
import type { TodoLangWorker } from './todoLangWorker';
// import { languageID } from './config';
// const languageID = 'AviatorScript'
export class WorkerManager {

  private worker: monaco.editor.MonacoWebWorker<TodoLangWorker>;
  private workerClientProxy: Promise<TodoLangWorker>;

  constructor(private languageID) {
    this.worker = null;
  }

  private getClientproxy(): Promise<TodoLangWorker> {
    // console.log(!this.workerClientProxy, this.languageID, '!this.workerClientProxy');
    //判断是否存在worker代理
    if (!this.workerClientProxy) {

      this.worker = monaco.editor.createWebWorker<TodoLangWorker>({
        // module that exports the create() method and returns a `JSONWorker` instance
        moduleId: 'vs/language/vue/TodoLangWorker',
        label: this.languageID,
        // passed in to the create() method
        //通过postMessage传递给子线程，self.onmessage中monacoWorker.initialize中获取createData
        createData: {
          languageId: this.languageID,
          // parse: service.parse
        }
      });
      this.workerClientProxy = <Promise<TodoLangWorker>><any>this.worker.getProxy();
    }
    return this.workerClientProxy;
  }

  async getLanguageServiceWorker(...resources: Uri[]): Promise<TodoLangWorker> {
    console.log('WorkerManager:resources', resources)
    const _client: TodoLangWorker = await this.getClientproxy();
    console.log('WorkerManager:_client', _client);
    await this.worker.withSyncedResources(resources)
    return _client;
  }
}
