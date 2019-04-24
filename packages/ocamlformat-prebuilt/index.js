try {
  module.exports = require("@dawee/ocamlformat-prebuilt-linux");
} catch (_error) {
  try {
    module.exports = require("@dawee/ocamlformat-prebuilt-mac");
  } catch (_error) {
    try {
      module.exports = require("@dawee/ocamlformat-prebuilt-windows");
    } catch (_error) {
      throw new Error("No suitable version installed for ocamlformat-prebuilt");
    }
  }
}
