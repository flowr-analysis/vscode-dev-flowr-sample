"use strict";
// Contains the class and some functions that are used to track positions in a document
// and display their slices
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
exports.PositionSlicer = exports.positionSlicers = void 0;
exports.addCurrentPositions = addCurrentPositions;
exports.getActivePositionSlicer = getActivePositionSlicer;
exports.disposeActivePositionSlicer = disposeActivePositionSlicer;
exports.addPositions = addPositions;
const vscode = __importStar(require("vscode"));
const extension_1 = require("./extension");
const doc_provider_1 = require("./doc-provider");
const utils_1 = require("./flowr/utils");
const slice_1 = require("./slice");
const selection_slicer_1 = require("./selection-slicer");
const settings_1 = require("./settings");
const positionSlicerAuthority = 'doc-slicer';
const positionSlicerSuffix = 'Slice';
// A map of all active position slicers
// Slicers are removed when they have no more tracked positions
exports.positionSlicers = new Map();
// Add the current cursor position(s) in the active editor to the list of slice criteria
async function addCurrentPositions() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }
    const positions = editor.selections.map(sel => sel.start);
    await addPositions(positions, editor.document);
}
// Get the position slicer for the active doc, if any
function getActivePositionSlicer() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return undefined;
    }
    const doc = editor.document;
    return exports.positionSlicers.get(doc);
}
// If the active document has a position slicer, dispose it and return true, else false
function disposeActivePositionSlicer() {
    const slicer = getActivePositionSlicer();
    if (!slicer) {
        return false;
    }
    slicer.dispose();
    exports.positionSlicers.delete(slicer.doc);
    (0, extension_1.updateStatusBar)();
    return true;
}
// Add a list of positions in a document to the slice criteria
async function addPositions(positions, doc) {
    // Get or create a slicer for the document
    const flowrSlicer = exports.positionSlicers.get(doc) || new PositionSlicer(doc);
    if (!exports.positionSlicers.has(doc)) {
        exports.positionSlicers.set(doc, flowrSlicer);
    }
    // Try to toggle the indicated positions
    const ret = flowrSlicer.togglePositions(positions);
    if (ret) {
        // Update the output if any positions were toggled
        await flowrSlicer.updateOutput();
    }
    if (flowrSlicer.offsets.length === 0) {
        // Dispose the slicer if no positions are sliced (anymore)
        flowrSlicer.dispose();
        exports.positionSlicers.delete(doc);
        (0, extension_1.updateStatusBar)();
        return undefined;
    }
    else {
        // If the slicer is active, make sure there are no selection-slice decorations in its editors
        (0, selection_slicer_1.getSelectionSlicer)().clearSliceDecos(undefined, doc);
    }
    return flowrSlicer;
}
class PositionSlicer {
    listeners = [];
    doc;
    offsets = [];
    sliceDecos = undefined;
    positionDeco;
    disposables = [];
    constructor(doc) {
        this.doc = doc;
        this.positionDeco = (0, slice_1.makeSliceDecorationTypes)().slicedPos;
        this.disposables.push(vscode.workspace.onDidChangeTextDocument(async (e) => {
            await this.onDocChange(e);
        }));
        this.disposables.push(vscode.window.onDidChangeVisibleTextEditors((editors) => {
            if (editors.some(e => e.document === this.doc)) {
                void this.updateOutput();
            }
        }));
    }
    dispose() {
        // Clear the content provider, decorations and tracked positions
        const provider = (0, doc_provider_1.getReconstructionContentProvider)();
        const uri = (0, doc_provider_1.makeUri)(positionSlicerAuthority, positionSlicerSuffix);
        provider.updateContents(uri, undefined);
        this.positionDeco?.dispose();
        this.sliceDecos?.dispose();
        while (this.disposables.length > 0) {
            this.disposables.pop()?.dispose();
        }
        this.offsets = [];
    }
    togglePositions(positions) {
        // convert positions to offsets
        let offsets = positions.map(pos => this.normalizeOffset(pos));
        offsets = offsets.filter(i => i >= 0);
        // return early if no valid offsets
        if (offsets.length === 0) {
            return false;
        }
        // add offsets that are not yet tracked
        let onlyRemove = true;
        for (const offset of offsets) {
            const idx = this.offsets.indexOf(offset);
            if (idx < 0) {
                this.offsets.push(offset);
                onlyRemove = false;
            }
        }
        // if all offsets are already tracked, toggle them off
        if (onlyRemove) {
            this.offsets = this.offsets.filter(offset => !offsets.includes(offset));
        }
        return true;
    }
    async showReconstruction() {
        const uri = this.makeUri();
        return (0, doc_provider_1.showUri)(uri);
    }
    async updateOutput(resetDecos = false) {
        if (resetDecos) {
            this.clearSliceDecos();
            this.positionDeco.dispose();
            this.positionDeco = (0, slice_1.makeSliceDecorationTypes)().slicedPos;
        }
        const provider = (0, doc_provider_1.getReconstructionContentProvider)();
        this.updateTargetDecos();
        const code = await this.updateSlices() || '# No slice';
        const uri = this.makeUri();
        provider.updateContents(uri, code);
        (0, extension_1.updateStatusBar)();
    }
    makeUri() {
        const docPath = this.doc.uri.path + ` - ${positionSlicerSuffix}`;
        return (0, doc_provider_1.makeUri)(positionSlicerAuthority, docPath);
    }
    async onDocChange(e) {
        // Check if there are changes to the tracked document
        if (e.document !== this.doc) {
            return;
        }
        if (e.contentChanges.length == 0) {
            return;
        }
        // Compute new offsets after the changes
        const newOffsets = [];
        for (let offset of this.offsets) {
            for (const cc of e.contentChanges) {
                offset = shiftOffset(offset, cc);
                if (offset < 0) {
                    break;
                }
            }
            offset = this.normalizeOffset(offset);
            if (offset >= 0 && !newOffsets.includes(offset)) {
                newOffsets.push(offset);
            }
        }
        this.offsets = newOffsets;
        // Update decos and editor output
        await this.updateOutput();
    }
    normalizeOffset(offsetOrPos) {
        // Convert a position to an offset and move it to the beginning of the word
        if (typeof offsetOrPos === 'number') {
            if (offsetOrPos < 0) {
                return -1;
            }
            offsetOrPos = this.doc.positionAt(offsetOrPos);
        }
        const range = (0, utils_1.getPositionAt)(offsetOrPos, this.doc);
        if (!range) {
            return -1;
        }
        return this.doc.offsetAt(range.start);
    }
    updateTargetDecos() {
        // Update the decorations in the relevant editors
        const ranges = [];
        for (const offset of this.offsets) {
            const pos = this.doc.positionAt(offset);
            const range = (0, utils_1.getPositionAt)(pos, this.doc);
            if (range) {
                ranges.push(range);
            }
        }
        for (const editor of vscode.window.visibleTextEditors) {
            if (editor.document === this.doc) {
                this.sliceDecos ||= (0, slice_1.makeSliceDecorationTypes)();
                editor.setDecorations(this.positionDeco, ranges);
            }
        }
    }
    showErrors = true;
    async updateSlices() {
        // Update the decos that show the slice results
        const session = await (0, extension_1.getFlowrSession)();
        const positions = this.offsets.map(offset => this.doc.positionAt(offset));
        if (positions.length === 0) {
            this.clearSliceDecos();
            return;
        }
        const { code, sliceElements } = await session.retrieveSlice((0, utils_1.makeSlicingCriteria)(positions, this.doc, (0, extension_1.isVerbose)()), this.doc, this.showErrors);
        if (sliceElements.length === 0) {
            this.clearSliceDecos();
            if (this.showErrors) {
                setTimeout(() => this.setShowErrors(), (0, extension_1.getConfig)().get(settings_1.Settings.ErrorMessageTimer));
            }
            this.showErrors = false;
            return;
        }
        for (const editor of vscode.window.visibleTextEditors) {
            if (editor.document === this.doc) {
                this.sliceDecos ||= (0, slice_1.makeSliceDecorationTypes)();
                (0, slice_1.displaySlice)(editor, sliceElements, this.sliceDecos);
            }
        }
        return code;
    }
    clearSliceDecos() {
        this.sliceDecos?.dispose();
        this.sliceDecos = undefined;
    }
    setShowErrors() {
        this.showErrors = true;
    }
}
exports.PositionSlicer = PositionSlicer;
function shiftOffset(offset, cc) {
    if (cc.rangeOffset > offset) {
        // pos is before range -> no change
        return offset;
    }
    if (cc.rangeLength + cc.rangeOffset > offset) {
        // pos is inside range -> invalidate pos
        return -1;
    }
    // pos is after range -> adjust pos
    const offsetDelta = cc.text.length - cc.rangeLength;
    const offset1 = offset + offsetDelta;
    return offset1;
}
//# sourceMappingURL=position-slicer.js.map