const path = require("path");
const build = require("../ocamlformat-build");

if (!process.platform === "win32") {
  throw new Error("This package can only be published from a Windows platform");
}

build(path.resolve(__dirname, "ocamlformat.exe"));
