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
exports.FlowrInternalSession = void 0;
const vscode = __importStar(require("vscode"));
const extension_1 = require("../extension");
const settings_1 = require("../settings");
const dataflow_printer_1 = require("@eagleoutice/flowr/core/print/dataflow-printer");
const cfg_1 = require("@eagleoutice/flowr/util/cfg/cfg");
const utils_1 = require("./utils");
const shell_1 = require("@eagleoutice/flowr/r-bridge/shell");
const default_pipelines_1 = require("@eagleoutice/flowr/core/steps/pipeline/default-pipelines");
const retriever_1 = require("@eagleoutice/flowr/r-bridge/retriever");
const ast_1 = require("@eagleoutice/flowr/util/mermaid/ast");
const cfg_2 = require("@eagleoutice/flowr/util/mermaid/cfg");
const tree_sitter_executor_1 = require("@eagleoutice/flowr/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor");
const query_1 = require("@eagleoutice/flowr/queries/query");
const core_1 = require("@eagleoutice/flowr/cli/repl/core");
const print_version_1 = require("@eagleoutice/flowr/cli/repl/print-version");
const config_1 = require("@eagleoutice/flowr/config");
class FlowrInternalSession {
    static treeSitterInitialized = false;
    state;
    rVersion;
    working = false;
    parser;
    outputChannel;
    forcedEngine;
    constructor(outputChannel, forcedEngine) {
        this.outputChannel = outputChannel;
        this.forcedEngine = forcedEngine;
        this.state = 'inactive';
        (0, extension_1.updateStatusBar)();
    }
    async workingOnSlice(shell, fun) {
        try {
            this.setWorking(true);
            return fun(shell);
        }
        finally {
            this.setWorking(false);
        }
    }
    setWorking(working) {
        this.working = working;
        (0, extension_1.updateStatusBar)();
    }
    async initialize() {
        this.state = 'loading';
        (0, extension_1.updateStatusBar)();
        this.outputChannel.appendLine('Starting internal flowR engine');
        switch (this.forcedEngine ?? (0, extension_1.getConfig)().get(settings_1.Settings.Rengine)) {
            case 'r-shell': {
                let options = {
                    revive: 2 /* RShellReviveOptions.Always */,
                    sessionName: 'flowr - vscode'
                };
                const executable = (0, extension_1.getConfig)().get(settings_1.Settings.Rexecutable)?.trim();
                if (executable !== undefined && executable.length > 0) {
                    options = { ...options, pathToRExecutable: executable };
                }
                this.outputChannel.appendLine(`Using options ${JSON.stringify(options)}`);
                this.parser = new shell_1.RShell(options);
                this.parser.tryToInjectHomeLibPath();
                // wait at most 1 second for the version, since the R shell doesn't let us know if the path
                // we provided doesn't actually lead anywhere, or doesn't contain an R executable, etc.
                let handle;
                const timeout = new Promise(resolve => handle = setTimeout(() => resolve(null), 5000));
                await Promise.race([this.parser.usedRVersion(), timeout]).then((version) => {
                    clearTimeout(handle);
                    if (!version) {
                        const seeDoc = 'See documentation';
                        void vscode.window.showErrorMessage('The R version could not be determined. R needs to be installed and part of your PATH environment variable.', seeDoc)
                            .then(s => {
                            if (s === seeDoc) {
                                void vscode.env.openExternal(vscode.Uri.parse('https://github.com/flowr-analysis/vscode-flowr/blob/main/README.md#using'));
                            }
                        });
                        this.state = 'failure';
                        (0, extension_1.updateStatusBar)();
                    }
                    else {
                        this.outputChannel.appendLine(`Using R version ${version.toString()}`);
                        if (version.major < extension_1.MINIMUM_R_MAJOR) {
                            void vscode.window.showErrorMessage(`You are using R version ${version.toString()}, but ${extension_1.MINIMUM_R_MAJOR}.0.0 or higher is required.`);
                        }
                        else if (version.major < extension_1.BEST_R_MAJOR) {
                            void vscode.window.showWarningMessage(`You are using R version ${version.toString()}, which flowR has not been tested for. Version ${extension_1.BEST_R_MAJOR}.0.0 or higher is recommended.`);
                        }
                        this.state = 'active';
                        this.rVersion = version.toString();
                        (0, extension_1.updateStatusBar)();
                    }
                });
                break;
            }
            case 'tree-sitter': {
                if (!FlowrInternalSession.treeSitterInitialized) {
                    try {
                        const root = (0, extension_1.getWasmRootPath)();
                        this.outputChannel.appendLine('Initializing tree-sitter... (wasm at: ' + root + ')');
                        (0, config_1.amendConfig)({ engines: [{
                                    type: 'tree-sitter',
                                    wasmPath: `${root}/tree-sitter-r.wasm`,
                                    treeSitterWasmPath: `${root}/tree-sitter.wasm`
                                }] });
                        await tree_sitter_executor_1.TreeSitterExecutor.initTreeSitter();
                        FlowrInternalSession.treeSitterInitialized = true;
                    }
                    catch (e) {
                        this.outputChannel.appendLine('Error in init: ' + e?.message);
                    }
                }
                this.outputChannel.appendLine('Tree-sitter loaded!');
                this.parser = new tree_sitter_executor_1.TreeSitterExecutor();
                this.outputChannel.appendLine('Tree-sitter initialized!');
                this.state = 'active';
                this.rVersion = await this.parser.rVersion();
                (0, extension_1.updateStatusBar)();
            }
        }
    }
    destroy() {
        this.parser?.close();
    }
    async retrieveSlice(criteria, document, showErrorMessage = true) {
        if (!this.parser) {
            return {
                code: '',
                sliceElements: []
            };
        }
        try {
            return await this.workingOnSlice(this.parser, async () => await this.extractSlice(document, criteria));
        }
        catch (e) {
            this.outputChannel.appendLine('Error: ' + e?.message);
            e.stack?.split('\n').forEach(l => this.outputChannel.appendLine(l));
            if (showErrorMessage) {
                void vscode.window.showErrorMessage(`There was an error while extracting a slice: ${e?.message}. See the flowR output for more information.`);
            }
            return {
                code: '',
                sliceElements: []
            };
        }
    }
    async retrieveDataflowMermaid(document) {
        if (!this.parser) {
            return '';
        }
        const result = await (0, default_pipelines_1.createDataflowPipeline)(this.parser, {
            request: (0, retriever_1.requestFromInput)((0, utils_1.consolidateNewlines)(document.getText()))
        }).allRemainingSteps();
        return (0, dataflow_printer_1.dataflowGraphToMermaid)(result.dataflow);
    }
    async retrieveAstMermaid(document) {
        if (!this.parser) {
            return '';
        }
        return await this.workingOnSlice(this.parser, async (s) => {
            const result = await (0, default_pipelines_1.createNormalizePipeline)(s, {
                request: (0, retriever_1.requestFromInput)((0, utils_1.consolidateNewlines)(document.getText()))
            }).allRemainingSteps();
            return (0, ast_1.normalizedAstToMermaid)(result.normalize.ast);
        });
    }
    async retrieveCfgMermaid(document) {
        if (!this.parser) {
            return '';
        }
        return await this.workingOnSlice(this.parser, async (s) => {
            const result = await (0, default_pipelines_1.createNormalizePipeline)(s, {
                request: (0, retriever_1.requestFromInput)((0, utils_1.consolidateNewlines)(document.getText()))
            }).allRemainingSteps();
            return (0, cfg_2.cfgToMermaid)((0, cfg_1.extractCFG)(result.normalize), result.normalize);
        });
    }
    async extractSlice(document, criteria) {
        const content = (0, utils_1.consolidateNewlines)(document.getText());
        const slicer = (0, default_pipelines_1.createSlicePipeline)(this.parser, {
            criterion: criteria,
            request: (0, retriever_1.requestFromInput)(content)
        });
        const result = await slicer.allRemainingSteps();
        const sliceElements = (0, utils_1.makeSliceElements)(result.slice.result, id => result.normalize.idMap.get(id)?.location);
        if ((0, extension_1.isVerbose)()) {
            this.outputChannel.appendLine('slice: ' + JSON.stringify([...result.slice.result]));
        }
        return {
            code: result.reconstruct.code,
            sliceElements
        };
    }
    async retrieveQuery(document, query) {
        if (!this.parser) {
            throw new Error('No parser available');
        }
        const result = await (0, default_pipelines_1.createDataflowPipeline)(this.parser, {
            request: (0, retriever_1.requestFromInput)((0, utils_1.consolidateNewlines)(document.getText()))
        }).allRemainingSteps();
        if (result.normalize.hasError) {
            return [{}, true];
        }
        return [(0, query_1.executeQueries)({ ast: result.normalize, dataflow: result.dataflow }, query), result.normalize.hasError ?? false];
    }
    async runRepl(config) {
        if (!this.parser) {
            return;
        }
        config.output.stdout(await (0, print_version_1.versionReplString)(this.parser));
        await (0, core_1.repl)({ ...config, parser: this.parser });
    }
}
exports.FlowrInternalSession = FlowrInternalSession;
//# sourceMappingURL=internal-session.js.map