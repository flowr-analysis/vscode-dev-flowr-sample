"use strict";
// The class in this file is used to provide content for the reconstruction editor
//
// The content of files is updated by us using the .updateContents() method.
//
// The content of a file is requested by vscode using the .provideTextDocumentContent() method,
// when the corresponding URI is opened.
//
// To show a file, use the showUri function, defined below.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReconstructionContentProvider = exports.flowrScheme = void 0;
exports.makeUri = makeUri;
exports.showUri = showUri;
exports.getReconstructionContentProvider = getReconstructionContentProvider;
const vscode = __importStar(require("vscode"));
exports.flowrScheme = 'flowr';
class ReconstructionContentProvider {
    listeners = [];
    contents = new Map();
    onDidChange(listener) {
        this.listeners.push(listener);
        const dispo = new vscode.Disposable(() => {
            this.listeners = this.listeners.filter(l => l !== listener);
        });
        return dispo;
    }
    notifyListeners(uri) {
        for (const listener of this.listeners) {
            listener(uri);
        }
    }
    updateContents(uri, content) {
        if (content !== undefined) {
            this.contents.set(uri.toString(), content);
        }
        else {
            this.contents.delete(uri.toString());
        }
        this.notifyListeners(uri);
    }
    provideTextDocumentContent(uri) {
        return this.contents.get(uri.toString());
    }
}
exports.ReconstructionContentProvider = ReconstructionContentProvider;
function makeUri(authority, path) {
    if (authority && path && !path.startsWith('/')) {
        path = '/' + path;
    }
    const uri = vscode.Uri.from({
        scheme: exports.flowrScheme,
        authority: authority,
        path: path
    });
    return uri;
}
async function showUri(uri, language = 'r', viewColumn = vscode.ViewColumn.Beside) {
    for (const editor of vscode.window.visibleTextEditors) {
        if (editor.document.uri.toString() === uri.toString()) {
            return editor;
        }
    }
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.languages.setTextDocumentLanguage(doc, language);
    const editor = await vscode.window.showTextDocument(doc, {
        viewColumn: viewColumn,
        preserveFocus: true,
        selection: new vscode.Selection(doc.lineCount - 1, 0, doc.lineCount - 1, 0)
    });
    // scroll to bottom
    const lineCount = editor.document.lineCount;
    const lastLine = editor.document.lineAt(lineCount - 1);
    editor.selection = new vscode.Selection(lastLine.range.end, lastLine.range.end);
    editor.revealRange(lastLine.range, vscode.TextEditorRevealType.Default);
    setTimeout(() => {
        editor.revealRange(lastLine.range, vscode.TextEditorRevealType.Default);
    }, 50);
    return editor;
}
let reconstructionContentProvider;
function getReconstructionContentProvider() {
    if (!reconstructionContentProvider) {
        reconstructionContentProvider = new ReconstructionContentProvider();
        vscode.workspace.registerTextDocumentContentProvider(exports.flowrScheme, reconstructionContentProvider);
    }
    return reconstructionContentProvider;
}
//# sourceMappingURL=doc-provider.js.map