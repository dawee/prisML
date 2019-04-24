try {
  module.exports = require("@dawee/refmt-prebuilt-linux");
} catch (_error) {
  try {
    module.exports = require("@dawee/refmt-prebuilt-mac");
  } catch (_error) {
    try {
      module.exports = require("@dawee/refmt-prebuilt-windows");
    } catch (_error) {
      throw new Error("No suitable version installed for refmt-prebuilt");
    }
  }
}
