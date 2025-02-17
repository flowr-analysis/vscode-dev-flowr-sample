"use strict";
// Contains the class and some functions that are used to
// slice at the current cursor position
// (either per command or updating as the cursor moves)
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
exports.getCriteriaSlicer = getCriteriaSlicer;
const vscode = __importStar(require("vscode"));
const extension_1 = require("./extension");
const doc_provider_1 = require("./doc-provider");
const slice_1 = require("./slice");
const position_slicer_1 = require("./position-slicer");
const settings_1 = require("./settings");
const criteriaSlicerAuthority = 'criteria-slicer';
const criteriaSlicerPath = 'Dependency Slice';
// currently only one instance is used and never disposed
let criteriaSlicer;
function getCriteriaSlicer() {
    criteriaSlicer ??= new CriteriaSlicer();
    return criteriaSlicer;
}
class CriteriaSlicer {
    hasDoc = false;
    decos;
    decoratedEditors = [];
    // Slice once at the current cursor position
    async sliceFor(criteria) {
        return await this.update(criteria);
    }
    makeUri() {
        return (0, doc_provider_1.makeUri)(criteriaSlicerAuthority, criteriaSlicerPath);
    }
    async showReconstruction() {
        const uri = this.makeUri();
        return (0, doc_provider_1.showUri)(uri);
    }
    // Clear all slice decos or only the ones affecting a specific editor/document
    clearSliceDecos(editor, doc) {
        if (!this.decos) {
            return;
        }
        if (editor) {
            editor.setDecorations(this.decos.lineSlice, []);
            editor.setDecorations(this.decos.tokenSlice, []);
            if (!doc) {
                return;
            }
        }
        if (doc) {
            for (const editor of vscode.window.visibleTextEditors) {
                if (editor.document === doc) {
                    this.clearSliceDecos(editor);
                }
            }
            return;
        }
        this.decos?.dispose();
        this.decos = undefined;
    }
    async update(criteria) {
        const ret = await getSliceFor(criteria);
        if (ret === undefined) {
            return '';
        }
        const provider = (0, doc_provider_1.getReconstructionContentProvider)();
        const uri = this.makeUri();
        provider.updateContents(uri, ret.code);
        this.hasDoc = true;
        const clearOtherDecos = (0, extension_1.getConfig)().get(settings_1.Settings.StyleOnlyHighlightActiveSelection, false);
        for (const editor of this.decoratedEditors) {
            if (editor === ret.editor) {
                continue;
            }
            if (clearOtherDecos || position_slicer_1.positionSlicers.has(editor.document)) {
                this.clearSliceDecos(editor);
            }
        }
        this.decos ??= (0, slice_1.makeSliceDecorationTypes)();
        (0, slice_1.displaySlice)(ret.editor, ret.sliceElements, this.decos);
        this.decoratedEditors.push(ret.editor);
        return ret.code;
    }
}
async function getSliceFor(criteria) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }
    const flowrSession = await (0, extension_1.getFlowrSession)();
    if (!flowrSession) {
        return;
    }
    const ret = await flowrSession.retrieveSlice(criteria, editor.document, false);
    if (!ret.sliceElements.length) {
        return {
            code: '# No slice',
            sliceElements: [],
            editor: editor
        };
    }
    return {
        ...ret,
        editor
    };
}
//# sourceMappingURL=criteria-slicer.js.map