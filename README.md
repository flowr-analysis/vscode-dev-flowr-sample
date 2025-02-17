# *flowR* VS Code.dev Sample

This is a template repository that you can use to try out the *flowR* extension for Visual Studio Code right in your browser using [VS Code.dev](https://vscode.dev/). You don't even need to create your own repository!

<div align = center>
<br>

[![](https://img.shields.io/badge/Open_in_VS_Code.dev-a32638?style=flat&logo=github)](https://vscode.dev/github/flowr-analysis/vscode-dev-flowr-sample)

<br>
</div>

## How to Use

To set up your own *flowR* workspace, simply click the button above. When you open one of the R files provided as part of the sample, the site will ask you to install the *flowR* extension through a popup in the bottom-right corner. Select it and accept the approval popup to install the *flowR* extension. Once the extension is installed, you can get started using *flowR*!

## Things to Try

You can generate a [slice](https://github.com/flowr-analysis/flowr/wiki/Terminology#program-slice) of the currently highlighted variable in any of the sample code by using the **Slice for Cursor Position** command. All code that is not part of the generated slice will then be grayed out.

You can also view the reconstruction of a piece of code based on the current slice. The **Show Current Slice in Editor (Reconstruct)** command opens a view next to the current editor.

The extension has a lot more features to try! For a more extensive list, check out [the extension's README](https://github.com/flowr-analysis/vscode-flowr?tab=readme-ov-file#use).

### Example Use-Cases

This sample contains some randomly selected R files under [`./sample-files`](./sample-files/) you can use to play around - or use your own R files!
We have only modified these files to contain a meta-informational comment at the top, pointing to the full record.

1. Reviewing and comprehending existing R scripts
2. Reusing a figure or data cleaning step of a publication
3. Supporting maintenance and reproducibility
4. Interactively understand the impact of parts while developing the script
