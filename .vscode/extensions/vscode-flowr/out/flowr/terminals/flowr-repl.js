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
exports.showRepl = showRepl;
const vscode = __importStar(require("vscode"));
const ansi_1 = require("@eagleoutice/flowr/util/ansi");
const readline = __importStar(require("readline"));
const stream_1 = require("stream");
const core_1 = require("@eagleoutice/flowr/cli/repl/core");
function showRepl(context, session) {
    const writeEmitter = new vscode.EventEmitter();
    // make a readable stream
    const readable = new stream_1.Stream.Readable({
        read() { }
    });
    const writable = new stream_1.Stream.Writable({
        write(chunk, encoding, callback) {
            writeEmitter.fire(chunk.toString());
            callback();
        }
    });
    const terminal = vscode.window.createTerminal({
        name: 'flowr REPL',
        pty: {
            onDidWrite: writeEmitter.event,
            open: () => {
                void session.runRepl({
                    allowRSessionAccess: true,
                    history: [],
                    output: {
                        formatter: ansi_1.ansiFormatter,
                        stdout(text) {
                            writeEmitter.fire(text.replaceAll('\n', '\r\n') + '\r\n');
                        },
                        stderr(text) {
                            writeEmitter.fire(text.replaceAll('\n', '\r\n') + '\r\n');
                        }
                    },
                    rl: readline.createInterface({
                        input: readable,
                        output: writable,
                        tabSize: 4,
                        terminal: true,
                        history: [],
                        removeHistoryDuplicates: true,
                        completer: core_1.replCompleter
                    })
                });
            }, // Called when terminal is opened
            close: () => { }, // Called when terminal is closed
            handleInput: (data) => {
                readable.push(data);
            }
        }
    });
    terminal.show();
}
//# sourceMappingURL=flowr-repl.js.map