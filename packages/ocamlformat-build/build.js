const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const util = require("util");
const { sync: which } = require("which");

const version = "0.9";

const pfs = {
  copyFile: util.promisify(fs.copyFile),
  exists: util.promisify(fs.exists)
};

const esyPath = which("esy");
const clonePath = path.resolve(__dirname, `_build/ocamlformat`);

const builtEXEPath = path.resolve(
  clonePath,
  "_build/default/src/ocamlformat.exe"
);

function runCMD(cmd, params, options) {
  return new Promise(done => {
    const stream = spawn(cmd, params, options);

    stream.stdout.pipe(process.stdout);
    stream.stderr.pipe(process.stderr);
    stream.on("close", done);
  });
}

async function clone() {
  const exists = await pfs.exists(clonePath);

  return (
    !exists &&
    runCMD("git", ["clone", "git@github.com:ocaml-ppx/ocamlformat", clonePath])
  );
}

function patchPackage() {
  const packageSrc = path.resolve(__dirname, "patch/package.json");
  const packageDest = path.resolve(`${clonePath}/package.json`);

  return pfs.copyFile(packageSrc, packageDest);
}

function checkout() {
  return runCMD("git", ["checkout", "-b", "prisml", version], {
    cwd: clonePath
  });
}

function install(command) {
  return runCMD(esyPath, ["install"], { cwd: clonePath });
}

function build(command) {
  return runCMD(esyPath, ["build", "--release"], { cwd: clonePath });
}

function exportEXE(outputEXEPath) {
  return pfs.copyFile(builtEXEPath, outputEXEPath);
}

async function runScript(outputEXEPath) {
  await clone();
  await checkout();
  await patchPackage();
  await install();
  await build();
  await exportEXE(outputEXEPath);
}

if (require.main === module) {
  runScript(process.argv[2]);
}

module.exports = runScript;
