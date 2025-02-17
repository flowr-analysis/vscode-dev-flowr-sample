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
exports.Dependency = void 0;
exports.registerDependencyView = registerDependencyView;
const vscode = __importStar(require("vscode"));
const extension_1 = require("../../extension");
const utils_1 = require("../utils");
const FlowrDependencyViewId = 'flowr-dependencies';
/** returns disposer */
function registerDependencyView(output) {
    const data = new FlowrDependencyTreeView(output);
    const tv = vscode.window.createTreeView(FlowrDependencyViewId, {
        treeDataProvider: data
    });
    data.setTreeView(tv);
    return () => data.dispose();
}
const emptyDependencies = { libraries: [], readData: [], sourcedFiles: [], writtenData: [], '.meta': { timing: -1 } };
const emptyLocationMap = { map: {}, '.meta': { timing: -1 } };
class FlowrDependencyTreeView {
    output;
    activeDependencies = emptyDependencies;
    locationMap = emptyLocationMap;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    disposables = [];
    parent;
    constructor(output) {
        this.output = output;
        this.updateConfig();
        // trigger if config changes:
        this.disposables.push(vscode.workspace.onDidChangeConfiguration(async () => {
            this.updateConfig();
            await this.refresh();
        }));
        this.disposables.push(vscode.window.onDidChangeActiveTextEditor(async () => await this.refresh()));
        /* lazy startup patches */
        setTimeout(() => void this.refresh(), 500);
        setTimeout(() => void this.refresh(), 2000);
    }
    activeInterval;
    activeDisposable;
    updateConfig() {
        if (this.activeInterval) {
            clearInterval(this.activeInterval);
            this.activeInterval = undefined;
        }
        if (this.activeDisposable) {
            this.activeDisposable.dispose();
            this.activeDisposable = undefined;
        }
        switch ((0, extension_1.getConfig)().get('dependencyView.updateType', 'never')) {
            case 'never': break;
            case 'interval': {
                this.activeInterval = setInterval(() => void this.refresh(), (0, extension_1.getConfig)().get('dependencyView.updateInterval', 10000) * 1000);
                break;
            }
            case 'on save':
                this.activeDisposable = vscode.workspace.onWillSaveTextDocument(async () => await this.refresh());
                break;
            case 'on change':
                this.activeDisposable = vscode.workspace.onDidChangeTextDocument(async () => await this.refresh());
                break;
            default:
                this.output.appendLine(`[Dependencies View] Invalid update type: ${(0, extension_1.getConfig)().get('dependencyView.updateType')}`);
        }
    }
    setTreeView(tv) {
        this.parent = tv;
    }
    async getDependenciesForActiveFile() {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return { dep: emptyDependencies, loc: emptyLocationMap };
        }
        const session = await (0, extension_1.getFlowrSession)();
        const [result, error] = await session.retrieveQuery(activeEditor.document, [{ type: 'dependencies' }, { type: 'location-map' }]);
        if (error) {
            this.output.appendLine('[Dependencies View] Error: Could not retrieve dependencies');
            return 'error';
        }
        this.output.appendLine(`[Dependencies View] Refreshed! (Dependencies: ${result.dependencies['.meta'].timing}ms, Locations: ${result['location-map']['.meta'].timing}ms)`);
        return { dep: result.dependencies, loc: result['location-map'] };
    }
    working = false;
    textBuffer = new utils_1.RotaryBuffer(5);
    lastText = '';
    textFingerprint(text) {
        return text.trim().replace(/\s|^\s*#.*$/gm, '');
    }
    async refresh() {
        if (this.working) {
            return;
        }
        if (vscode.window.activeTextEditor?.document.languageId !== 'r') {
            return;
        }
        const text = this.textFingerprint(vscode.window.activeTextEditor?.document.getText());
        if (text === this.lastText) {
            return;
        }
        else {
            this.lastText = text ?? '';
        }
        this.output.appendLine('Refreshing dependencies');
        this.working = true;
        try {
            const has = this.textBuffer.get(e => e?.[0] === text);
            if (has) {
                try {
                    this.output.appendLine(`[Dependencies View] Using cached dependencies (Dependencies: ${has[1].dep['.meta'].timing}ms, Locations: ${has[1].loc['.meta'].timing}ms)`);
                }
                catch (e) {
                    this.output.appendLine(`[Dependencies View] Error: ${e.message}`);
                    this.output.appendLine(e.stack ?? '');
                }
                this.activeDependencies = has[1].dep;
                this.locationMap = has[1].loc;
                this._onDidChangeTreeData.fire(undefined);
                return;
            }
            await vscode.window.withProgress({ location: { viewId: FlowrDependencyViewId } }, () => {
                return this.getDependenciesForActiveFile().then(res => {
                    if (res === 'error') {
                        if ((0, extension_1.getConfig)().get('dependencyView.keepOnError', true)) {
                            return;
                        }
                        else {
                            this.activeDependencies = emptyDependencies;
                            this.locationMap = emptyLocationMap;
                            this._onDidChangeTreeData.fire(undefined);
                            return;
                        }
                    }
                    this.activeDependencies = res.dep;
                    this.locationMap = res.loc;
                    this.textBuffer.push([text, res]);
                    this._onDidChangeTreeData.fire(undefined);
                }).catch(e => {
                    this.output.appendLine(`[Dependencies View] Error: ${e}`);
                });
            });
        }
        catch (e) {
            this.output.appendLine('[Dependencies View] Error: Could not refresh dependencies');
            this.output.appendLine(e.message);
            this.output.appendLine(e.stack ?? '');
        }
        finally {
            this.working = false;
            setTimeout(() => void this.reveal(), 0);
        }
    }
    async reveal() {
        const children = await this.getChildren();
        const autoRevealUntil = (0, extension_1.getConfig)().get('dependencyView.autoReveal', 5);
        for (const root of children ?? []) {
            if (root.children?.length && root.children.length <= autoRevealUntil) {
                this.output.appendLine(`Revealing ${JSON.stringify(root.label)} as it has ${root.children.length} children (<= vscode-flowr.dependencyView.autoReveal)`);
                this.parent?.reveal(root, { select: false, focus: false, expand: true });
            }
        }
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (element) {
            return element.children ?? [];
        }
        else {
            return [
                this.makeDependency('Libraries', 'loads the library', this.activeDependencies.libraries, new vscode.ThemeIcon('library'), e => e.libraryName),
                this.makeDependency('Imported Data', 'imports the data', this.activeDependencies.readData, new vscode.ThemeIcon('file-text'), e => e.source),
                this.makeDependency('Sourced Scripts', 'sources the script', this.activeDependencies.sourcedFiles, new vscode.ThemeIcon('file-code'), e => e.file),
                this.makeDependency('Outputs', 'produces the output', this.activeDependencies.writtenData, new vscode.ThemeIcon('new-file'), e => e.destination)
            ];
        }
    }
    getParent(element) {
        return element.getParent();
    }
    makeDependency(label, verb, elements, themeIcon, getName) {
        const parent = new Dependency({ label, icon: themeIcon, root: true, verb, children: this.makeChildren(getName, elements, verb) });
        parent.children?.forEach(c => c.setParent(parent));
        return parent;
    }
    makeChildren(getName, elements, verb) {
        const unknownGuardedName = (e) => {
            const name = getName(e);
            if (name === 'unknown' && e.lexemeOfArgument) {
                return name + ': ' + e.lexemeOfArgument;
            }
            return name;
        };
        /* first group by name */
        const grouped = new Map();
        for (const e of elements) {
            const name = getName(e) + ' (' + e.functionName + ')';
            if (!grouped.has(name)) {
                grouped.set(name, []);
            }
            grouped.get(name)?.push(e);
        }
        return Array.from(grouped.entries()).map(([name, elements]) => {
            if (elements.length === 1) {
                return new Dependency({ label: unknownGuardedName(elements[0]), info: elements[0], locationMap: this.locationMap, verb });
            }
            const res = new Dependency({
                label: name,
                locationMap: this.locationMap,
                verb,
                icon: vscode.ThemeIcon.Folder,
                children: elements.map(e => new Dependency({
                    verb,
                    label: unknownGuardedName(e),
                    info: e,
                    locationMap: this.locationMap
                }))
            });
            res.children?.forEach(c => c.setParent(res));
            return res;
        });
    }
    dispose() {
        for (const d of this.disposables) {
            d.dispose();
        }
        if (this.activeInterval) {
            clearInterval(this.activeInterval);
        }
        if (this.activeDisposable) {
            this.activeDisposable.dispose();
        }
    }
}
class Dependency extends vscode.TreeItem {
    children;
    info;
    loc;
    parent;
    setParent(parent) {
        this.parent = parent;
    }
    getParent() {
        return this.parent;
    }
    constructor({ label, root = false, children = [], info, icon, locationMap, collapsibleState, parent, verb }) {
        collapsibleState ??= children.length === 0 ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed;
        super(label, collapsibleState);
        this.children = children;
        this.info = info;
        this.parent = parent;
        if (info) {
            this.loc = locationMap?.map[info.nodeId];
            this.description = `by ${info.functionName} in ${this.loc ? `(L. ${this.loc[0]})` : 'unknown location'}`;
            this.tooltip = `${verb} ${JSON.stringify(this.label)} with the "${info.functionName}" function in ${this.loc ? `line ${this.loc[0]}` : ' an unknown location (right-click for more)'}`;
            if (this.loc && vscode.window.activeTextEditor) {
                const start = new vscode.Position(this.loc[0] - 1, this.loc[1] - 1);
                const end = new vscode.Position(this.loc[2] - 1, this.loc[3]);
                this.command = {
                    /* simply move cursor to location */
                    command: 'editor.action.goToLocations',
                    title: 'go to location',
                    arguments: [
                        vscode.window.activeTextEditor.document.uri, // anchor uri and position
                        start,
                        [new vscode.Location(vscode.window.activeTextEditor.document.uri, new vscode.Range(start, end))], // locations
                        'goto'
                    ]
                };
            }
        }
        else if (children.length > 0) {
            this.tooltip = `${typeof this.label === 'string' ? this.label : ''}${info ? ' (right-click for more!)' : ''}`;
            this.description = `${children.length} item${children.length === 1 ? '' : 's'}`;
        }
        else {
            this.description = `${children.length} item${children.length === 1 ? '' : 's'}`;
        }
        if (icon) {
            this.iconPath = icon;
        }
        if (!root && info) {
            this.contextValue = 'dependency';
        }
    }
    getNodeId() {
        return this.info?.nodeId;
    }
    getLocation() {
        return this.loc;
    }
}
exports.Dependency = Dependency;
//# sourceMappingURL=dependency-view.js.map