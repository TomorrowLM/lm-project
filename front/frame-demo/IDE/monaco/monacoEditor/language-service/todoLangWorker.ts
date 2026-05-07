import type * as monaco from 'monaco-editor';
import TodoLangLanguageService from './LanguageService';
import type { ITodoLangError } from './TodoLangErrorListener';
import * as monacoWorker from 'monaco-editor/esm/vs/editor/editor.worker.js';
import IWorkerContext = monaco.worker.IWorkerContext;
//worker中代理方法需要去initialize先初始化TodoLangWorker
self.onmessage = () => {
    monacoWorker.initialize((ctx, CreateData) => {
        // console.log(ctx, CreateData);
        return new TodoLangWorker(ctx, CreateData)
    });
};
export class TodoLangWorker {
    private _ctx: IWorkerContext;
    private CreateData: any;
    private languageService: TodoLangLanguageService;
    constructor(ctx: IWorkerContext, CreateData: any) {
        // console.log('TodoLangWorker:ctx', ctx, CreateData);
        this._ctx = ctx;
        this.CreateData = CreateData;
        this.languageService = new TodoLangLanguageService();
    }
    doValidation(model: monaco.editor.IModel): Promise<ITodoLangError[]> {
        // console.log('TodoLangWorker:ctx', this._ctx, this.CreateData);
        const code = this.getTextDocument();
        // console.log(code)
        return Promise.resolve(this.languageService.validate(code, this.CreateData));
    }
    format(code: string): Promise<string> {
        return Promise.resolve(this.languageService.format(code));
    }
    private getTextDocument(): string {
        const model = this._ctx.getMirrorModels()[0];// When there are multiple files open, this will be an array
        return model.getValue();
    }

}
