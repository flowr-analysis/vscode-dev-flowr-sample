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
const vscode = __importStar(require("vscode"));
const assert = __importStar(require("assert"));
const test_util_1 = require("./test-util");
suite('slice', () => {
    suiteSetup(async () => {
        await (0, test_util_1.activateExtension)();
    });
    test('slice cursor', async () => {
        await (0, test_util_1.openTestFile)('example.R', new vscode.Selection(7, 6, 7, 6));
        const slice = await vscode.commands.executeCommand('vscode-flowr.slice.cursor');
        assert.ok(slice);
        assert.equal(slice, `
product <- 1
n <- 10
for(i in 1:(n - 1)) product <- product * i
			`.trim());
    });
    test('reconstruct cursor', async () => {
        await (0, test_util_1.openTestFile)('example.R', new vscode.Selection(7, 6, 7, 6));
        const newEditor = await vscode.commands.executeCommand('vscode-flowr.slice.show.in.editor');
        assert.ok(newEditor);
        assert.ok(newEditor.document.fileName.endsWith('Selection Slice'));
        assert.equal(newEditor.document.getText(), `
product <- 1
n <- 10
for(i in 1:(n - 1)) product <- product * i
			`.trim());
    });
});
//# sourceMappingURL=slice.test.js.map