import * as monaco from 'monaco-editor';
// import { WorkerAccessor } from "./setup";
// import { languageID } from './config';
// import { WorkerAccessor } from "./setup";
// import { languageID } from './config';
import type { ITodoLangError } from './TodoLangErrorListener';

export default class DiagnosticsAdapter {
    codeInfo: any;
    constructor(private worker: WorkerAccessor) {
        const onModelAdd = (model: monaco.editor.IModel): void => {
            let handle: any;
            model.onDidChangeContent(() => {
                // here we are Debouncing the user changes, so everytime a new change is done, we wait 500ms before validating
                // otherwise if the user is still typing, we cancel the
                clearTimeout(handle);
                handle = setTimeout(() => this.validate(model.uri), 500);
            });
            this.validate(model.uri);
        };
        monaco.editor.onDidCreateModel(onModelAdd);
        monaco.editor.getModels().forEach(onModelAdd);
    }
    private async validate(resource: monaco.Uri): Promise<void> {
        console.log(this.worker, 1122);
        // get the worker proxy
        const worker = await this.worker(resource)
        // get the current model(editor or file) which is only one
        const model = monaco.editor.getModel(resource);
        // console.log(worker);
        // call the validate methode proxy from the langaueg service and get errors
        const errorMarkers = await worker.doValidation(resource);
        // console.log(errorMarkers);
        // add the error markers and underline them with severity of Error
        monaco.editor.setModelMarkers(model, model.getLanguageId(), errorMarkers);
        // monaco.editor.setModelMarkers(model, model.getLanguageId(), errorMarkers.map(toDiagnostics));

    }
}
function toDiagnostics(error: ITodoLangError): monaco.editor.IMarkerData {
    return {
        ...error,
        severity: monaco.MarkerSeverity.Error,
    };
}