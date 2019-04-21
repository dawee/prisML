import { spawn, ChildProcess } from "child_process";
import { exists, stat, readdir, readFile, Stats, writeFile } from "fs";
import { basename, resolve as resolvePath } from "path";
import * as vscode from "vscode";
import { promisify } from "util";
import { sync as which } from "which";

enum Syntax {
  OCaml = "ml",
  ReasonML = "re"
}

const pfs = {
  exists: promisify(exists),
  stat: promisify(stat),
  readdir: promisify(readdir),
  readFile: promisify(readFile),
  writeFile: promisify(writeFile)
};

const stringifySyntax = (syntax: Syntax) => {
  switch (syntax) {
    case Syntax.OCaml:
      return "ml";
    case Syntax.ReasonML:
      return "re";
  }
};

const refmtPath = resolvePath(__dirname, "../refmt.exe");
const ocamlformatPath = resolvePath(__dirname, "../ocamlformat.exe");

function promisifyChildProcess(
  input: Uint8Array,
  childProcess: ChildProcess
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    let stdoutBuffer = Buffer.from([]);

    childProcess.stdout.on("data", data => {
      stdoutBuffer = Buffer.concat([stdoutBuffer, data]);
    });

    childProcess.on("close", _code => {
      resolve(stdoutBuffer);
    });

    childProcess.stdin.write(input);
    childProcess.stdin.end();
  });
}

function refmt(
  input: Uint8Array,
  path: string,
  parse: Syntax,
  print: Syntax
): Promise<Uint8Array> {
  const childProcess = spawn(refmtPath, [
    `--parse=${stringifySyntax(parse)}`,
    `--print=${stringifySyntax(print)}`,
    `--interface=${isInterface(path) ? "true" : "false"}`
  ]);

  return promisifyChildProcess(input, childProcess);
}

function ocamlformat(input: Uint8Array, path: string): Promise<Uint8Array> {
  const childProcess = spawn(ocamlformatPath, [
    `-`,
    `--name=${basename(path)}`
  ]);

  return promisifyChildProcess(input, childProcess);
}

function reformat(
  input: Uint8Array,
  path: string,
  parse: Syntax,
  print: Syntax
): Promise<Uint8Array> {
  if (parse === Syntax.ReasonML && print === Syntax.OCaml) {
    return refmt(input, path, parse, print).then(rawOCaml =>
      ocamlformat(rawOCaml, path)
    );
  } else if (parse === Syntax.OCaml && print === Syntax.ReasonML) {
    return ocamlformat(input, path).then(cleanOCaml =>
      refmt(cleanOCaml, path, parse, print)
    );
  } else {
    return refmt(input, path, parse, print);
  }
}

function getURIScheme(prism: Syntax) {
  return "prism-" + prism.valueOf();
}

function absoluteURI(
  prism: Syntax,
  parent: string,
  node: string | null = null
) {
  const scheme = getURIScheme(prism);

  const path = (node !== null ? resolvePath(parent, node) : parent).replace(
    "\\",
    "/"
  );

  return vscode.Uri.parse(
    path.startsWith("/") ? `${scheme}:/${path}` : `${scheme}://${path}`
  );
}

function getOppositeSyntax(prism: Syntax) {
  switch (prism) {
    case Syntax.OCaml:
      return Syntax.ReasonML;
    case Syntax.ReasonML:
      return Syntax.OCaml;
  }
}

function getRealNamePattern(prism: Syntax) {
  switch (prism) {
    case Syntax.OCaml:
      return /^(.*)\.rei?$/;
    case Syntax.ReasonML:
      return /^(.*)\.mli?$/;
  }
}

function getVirtualNamePattern(prism: Syntax) {
  switch (prism) {
    case Syntax.OCaml:
      return /^(.*)_re\.mli?$/;
    case Syntax.ReasonML:
      return /^(.*)_ml\.rei?$/;
  }
}

function isInterface(name: string) {
  return name.match(/^.*\.(rei|mli)$/) !== null;
}

function getVirtualName(prism: Syntax, name: string) {
  const pattern = getRealNamePattern(prism);
  const match = name.match(pattern);

  if (match === null) {
    return name;
  } else {
    const parseSyntax = getOppositeSyntax(prism);
    const baseVirtualName =
      match[1] + "_" + parseSyntax.valueOf() + "." + prism.valueOf();

    return isInterface(name) ? baseVirtualName + "i" : baseVirtualName;
  }
}

function getRealName(prism: Syntax, name: string) {
  const pattern = getVirtualNamePattern(prism);
  const match = name.match(pattern);

  if (match === null) {
    return name;
  } else {
    const parseSyntax = getOppositeSyntax(prism);
    const baseVirtualName = match[1] + "." + parseSyntax.valueOf();

    return isInterface(name) ? baseVirtualName + "i" : baseVirtualName;
  }
}

export class PrisML implements vscode.FileSystemProvider {
  private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  private _prism: Syntax;

  onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

  constructor(prism: Syntax) {
    this._prism = prism;
  }

  watch(
    uri: vscode.Uri,
    options: { recursive: boolean; excludes: string[] }
  ): vscode.Disposable {
    throw new Error("Method not implemented.");
  }

  getURIType(stats: Stats | null) {
    if (stats === null) {
      return vscode.FileType.Unknown;
    } else if (stats.isFile()) {
      return vscode.FileType.File;
    } else {
      return vscode.FileType.Directory;
    }
  }

  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    const uriExists = await pfs.exists(uri.path);
    const stats = uriExists ? await pfs.stat(uri.path) : null;

    const type = this.getURIType(stats);
    const { ctime = 0, mtime = 0, size = 0 } = stats || {};

    return {
      type,
      mtime: mtime instanceof Date ? mtime.getMilliseconds() : mtime,
      ctime: ctime instanceof Date ? ctime.getMilliseconds() : ctime,
      size
    };
  }

  async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    const uriCopy = uri; // for a mysterious reason Typescript won't let me use uri directly in my anonymous function
    const nodes = await pfs.readdir(uri.path);
    const promises = nodes.map(
      async (name: string): Promise<[string, vscode.FileType]> => {
        const uri = absoluteURI(this._prism, uriCopy.path, name);
        const { type } = await this.stat(uri);
        const virtualName = getVirtualName(this._prism, name);

        return [virtualName, type];
      }
    );

    return Promise.all(promises);
  }

  createDirectory(uri: vscode.Uri) {
    throw new Error("Method not implemented.");
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const realPath = getRealName(this._prism, uri.path);
    const parseSyntax = getOppositeSyntax(this._prism);
    const data = await pfs.readFile(realPath);

    return realPath !== uri.path
      ? reformat(data, uri.path, parseSyntax, this._prism)
      : data;
  }

  async writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean }
  ): Promise<void> {
    const realPath = getRealName(this._prism, uri.path);
    const printSyntax = getOppositeSyntax(this._prism);
    const data =
      realPath !== uri.path
        ? await reformat(content, uri.path, this._prism, printSyntax)
        : content;

    return pfs.writeFile(realPath, data);
  }

  delete(
    uri: vscode.Uri,
    options: { recursive: boolean }
  ): void | Thenable<void> {
    throw new Error("Method not implemented.");
  }

  rename(
    oldUri: vscode.Uri,
    newUri: vscode.Uri,
    options: { overwrite: boolean }
  ): void | Thenable<void> {
    throw new Error("Method not implemented.");
  }
}

function registerPrisML(prism: Syntax, context: vscode.ExtensionContext) {
  const prisml = new PrisML(prism);
  const scheme = getURIScheme(prism);
  const disposable = vscode.workspace.registerFileSystemProvider(
    scheme,
    prisml,
    {
      isCaseSensitive: true
    }
  );

  context.subscriptions.push(disposable);
}

function registerOpenCommand(
  name: string,
  prism: Syntax,
  context: vscode.ExtensionContext
) {
  const disposable = vscode.commands.registerCommand(name, async () => {
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true
    });

    if (Array.isArray(uris) && uris.length === 1) {
      vscode.workspace.updateWorkspaceFolders(0, 0, {
        uri: absoluteURI(prism, uris[0].path),
        name: `${basename(uris[0].path)} - PrisML`
      });
    }
  });

  context.subscriptions.push(disposable);
}

export function activate(context: vscode.ExtensionContext) {
  registerPrisML(Syntax.OCaml, context);
  registerPrisML(Syntax.ReasonML, context);

  registerOpenCommand("prisml.reasonmlPrism", Syntax.ReasonML, context);
}

// this method is called when your extension is deactivated
export function deactivate() {}
