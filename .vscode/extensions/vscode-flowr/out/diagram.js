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
exports.registerDiagramCommands = registerDiagramCommands;
const vscode = __importStar(require("vscode"));
const extension_1 = require("./extension");
const settings_1 = require("./settings");
function registerDiagramCommands(context, output) {
    context.subscriptions.push(vscode.commands.registerCommand('vscode-flowr.dataflow', async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const mermaid = await (await (0, extension_1.getFlowrSession)()).retrieveDataflowMermaid(activeEditor.document);
            if (mermaid) {
                return { mermaid, webview: createWebview('flowr-dataflow', 'Dataflow Graph', mermaid, output) };
            }
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-flowr.ast', async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const ast = await (await (0, extension_1.getFlowrSession)()).retrieveAstMermaid(activeEditor.document);
            if (ast) {
                createWebview('flowr-ast', 'AST', ast, output);
            }
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-flowr.cfg', async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const cfg = await (await (0, extension_1.getFlowrSession)()).retrieveCfgMermaid(activeEditor.document);
            if (cfg) {
                createWebview('flowr-cfg', 'Control Flow Graph', cfg, output);
            }
        }
    }));
}
function createWebview(id, name, mermaid, output) {
    // https://github.com/mermaid-js/mermaid/blob/47601ac311f7ad7aedfaf280d319d75434680622/packages/mermaid/src/mermaidAPI.ts#L315-L317
    if (mermaid.length > mermaidMaxTextLength()) {
        void vscode.window.showErrorMessage('The diagram is too large to be displayed by Mermaid. You can find its code in the flowR output panel instead. Additionally, you can change the maximum diagram length in the extension settings.');
        output.appendLine(mermaid);
        return undefined;
    }
    const panel = vscode.window.createWebviewPanel(id, name, vscode.ViewColumn.Beside, {
        enableScripts: true
    });
    panel.webview.html = createDocument(mermaid);
    return panel;
}
function createDocument(mermaid) {
    const theme = vscode.window.activeColorTheme.kind == vscode.ColorThemeKind.Light ? 'default' : 'dark';
    return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">

	<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
	<script src="https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.1/dist/svg-pan-zoom.min.js"></script>
	<script>
		mermaid.initialize({
			startOnLoad: false,
			securityLevel: 'loose',
			theme: '${theme}',
			maxTextSize: ${mermaidMaxTextLength()},
			// we set maxEdges so that it's never able to trigger, since we only safeguard against maxTextSize
			maxEdges: Number.MAX_SAFE_INTEGER
		})
	</script>

	<style>
		.mermaid svg {
			position: absolute;
			max-width: 100% !important;
			max-height: 100% !important;
			width: 100%;
			height: 100%;
			top: 0;
			left: 0;
		}
	</style>
</head>
<body>
	<pre class="mermaid">
		${mermaid}
	</pre>
	<script>
		mermaid.run().then(() => {
			const panZoom = svgPanZoom('.mermaid svg', { controlIconsEnabled: true })
			addEventListener("resize", () => panZoom.resize())
		})
	</script>
</body>
</html>`;
}
function mermaidMaxTextLength() {
    return (0, extension_1.getConfig)().get(settings_1.Settings.StyleMermaidMaxTextLength, 500000);
}
//# sourceMappingURL=diagram.js.map