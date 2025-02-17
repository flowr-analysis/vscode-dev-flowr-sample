"use strict";
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
exports.BEST_R_MAJOR = exports.MINIMUM_R_MAJOR = void 0;
exports.activate = activate;
exports.getConfig = getConfig;
exports.isVerbose = isVerbose;
exports.establishInternalSession = establishInternalSession;
exports.getFlowrSession = getFlowrSession;
exports.establishServerSession = establishServerSession;
exports.destroySession = destroySession;
exports.updateStatusBar = updateStatusBar;
exports.isWeb = isWeb;
exports.getWasmRootPath = getWasmRootPath;
const vscode = __importStar(require("vscode"));
const internal_session_1 = require("./flowr/internal-session");
const server_session_1 = require("./flowr/server-session");
const settings_1 = require("./settings");
const slice_1 = require("./slice");
const diagram_1 = require("./diagram");
const selection_slicer_1 = require("./selection-slicer");
const position_slicer_1 = require("./position-slicer");
const version_1 = require("@eagleoutice/flowr/util/version");
const dependency_view_1 = require("./flowr/views/dependency-view");
const flowr_repl_1 = require("./flowr/terminals/flowr-repl");
exports.MINIMUM_R_MAJOR = 3;
exports.BEST_R_MAJOR = 4;
let extensionContext;
let outputChannel;
let statusBarItem;
let flowrSession;
async function activate(context) {
    extensionContext = context;
    outputChannel = vscode.window.createOutputChannel('flowR');
    outputChannel.appendLine(`flowR extension activated (ships with flowR v${(0, version_1.flowrVersion)().toString()})`);
    (0, diagram_1.registerDiagramCommands)(context, outputChannel);
    (0, slice_1.registerSliceCommands)(context, outputChannel);
    context.subscriptions.push(vscode.commands.registerCommand('vscode-flowr.session.internal', async () => {
        await establishInternalSession();
        return flowrSession;
    }));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-flowr.session.connect', async () => {
        await establishServerSession();
        return flowrSession;
    }));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-flowr.session.disconnect', () => {
        if (flowrSession instanceof server_session_1.FlowrServerSession) {
            destroySession();
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-flowr.repl', async () => {
        (0, flowr_repl_1.showRepl)(context, await getFlowrSession());
    }));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-flowr.settings.open', async () => {
        await vscode.commands.executeCommand('workbench.action.openSettings', settings_1.Settings.Category);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-flowr.report', () => {
        void vscode.env.openExternal(vscode.Uri.parse('https://github.com/flowr-analysis/flowr/issues/new/choose'));
    }));
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBarItem);
    updateStatusBar();
    context.subscriptions.push(new vscode.Disposable(() => destroySession()));
    const disposeDep = (0, dependency_view_1.registerDependencyView)(outputChannel);
    context.subscriptions.push(new vscode.Disposable(() => disposeDep()));
    process.on('SIGINT', () => destroySession());
    if (getConfig().get(settings_1.Settings.ServerAutoConnect)) {
        await establishServerSession();
    }
}
function getConfig() {
    return vscode.workspace.getConfiguration(settings_1.Settings.Category);
}
function isVerbose() {
    return getConfig().get(settings_1.Settings.VerboseLog, false);
}
async function establishInternalSession(forcedEngine) {
    destroySession();
    flowrSession = new internal_session_1.FlowrInternalSession(outputChannel, forcedEngine);
    await flowrSession.initialize();
    return flowrSession;
}
async function getFlowrSession() {
    if (flowrSession) {
        return flowrSession;
    }
    // initialize a default session if none is active
    // on the web, we always want to use the tree-sitter backend since we can't run R
    return await establishInternalSession(isWeb() ? 'tree-sitter' : undefined);
}
async function establishServerSession() {
    destroySession();
    flowrSession = new server_session_1.FlowrServerSession(outputChannel);
    await flowrSession.initialize();
    return flowrSession;
}
function destroySession() {
    flowrSession?.destroy();
    flowrSession = undefined;
}
function updateStatusBar() {
    const text = [];
    const tooltip = [];
    if (flowrSession instanceof server_session_1.FlowrServerSession) {
        text.push(`$(cloud) flowR ${flowrSession.state}`);
        if (flowrSession.state === 'connected') {
            tooltip.push(`R version ${flowrSession.rVersion}  \nflowR version ${flowrSession.flowrVersion}`);
        }
        if (flowrSession.working) {
            text.push('$(loading~spin) Analyzing');
        }
    }
    else if (flowrSession instanceof internal_session_1.FlowrInternalSession) {
        text.push(`$(console) flowR ${flowrSession.state}`);
        if (flowrSession.state === 'active') {
            tooltip.push(`R version ${flowrSession.rVersion}  \nflowR version ${(0, version_1.flowrVersion)().toString()}  \nEngine ${flowrSession.parser?.name}`);
        }
        if (flowrSession.working) {
            text.push('$(loading~spin) Analyzing');
        }
    }
    const slicingTypes = [];
    const slicingFiles = [];
    if (selection_slicer_1.selectionSlicer?.changeListeners.length) {
        slicingTypes.push('cursor');
    }
    if (position_slicer_1.positionSlicers.size) {
        const pos = [...position_slicer_1.positionSlicers].reduce((i, [, s]) => i + s.offsets.length, 0);
        if (pos > 0) {
            slicingTypes.push(`${pos} position${pos === 1 ? '' : 's'}`);
            for (const [doc, slicer] of position_slicer_1.positionSlicers) {
                slicingFiles.push(`${vscode.workspace.asRelativePath(doc.fileName)} (${slicer.offsets.length} position${slicer.offsets.length === 1 ? '' : 's'})`);
            }
        }
    }
    if (slicingTypes.length) {
        text.push(`$(lightbulb) Slicing ${slicingTypes.join(', ')}`);
        if (slicingFiles.length) {
            tooltip.push(`Slicing in\n${slicingFiles.map(f => `- ${f}`).join('\n')}`);
        }
    }
    if (text.length) {
        statusBarItem.show();
        statusBarItem.text = text.join(' ');
        statusBarItem.tooltip = tooltip.length ? tooltip.reduce((m, s) => m.appendMarkdown('\n\n').appendMarkdown(s), new vscode.MarkdownString()) : undefined;
    }
    else {
        statusBarItem.hide();
    }
}
function isWeb() {
    // apparently there is no official way to test this from the vscode api other
    // than in the command availability context stuff, which is not what we want
    // this is dirty but it should work since the WebSocket is unavailable in node
    return typeof WebSocket !== 'undefined';
}
function getWasmRootPath() {
    if (!isWeb()) {
        return `${__dirname}/flowr/tree-sitter`;
    }
    else {
        const uri = vscode.Uri.joinPath(extensionContext.extensionUri, '/dist/web');
        // in the fake browser version of vscode, it needs to be a special scheme, so we do this check
        return uri.scheme !== 'file' ? uri.toString() : `vscode-file://vscode-app/${uri.fsPath}`;
    }
}
//# sourceMappingURL=extension.js.map