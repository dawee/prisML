const path = require ('path');
const build = require ('../ocamlformat-build');

build ('0.9', 'win32', path.resolve (__dirname, 'ocamlformat.exe'));
