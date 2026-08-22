const { withDangerousMod } = require("expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

const FONT_FILES = ["Syne-ExtraBold.ttf", "Syne-Bold.ttf", "Outfit-Medium.ttf", "Outfit-SemiBold.ttf"];

/**
 * Copy brand TTF into Android assets/fonts so React Native registers them
 * without the expo-font native module (excluded: FontLoader crash).
 */
function withBrandFonts(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const dest = path.join(config.modRequest.platformProjectRoot, "app/src/main/assets/fonts");
      await fs.promises.mkdir(dest, { recursive: true });
      const srcDir = path.join(config.modRequest.projectRoot, "assets/fonts");
      for (const file of FONT_FILES) {
        const from = path.join(srcDir, file);
        if (fs.existsSync(from)) {
          await fs.promises.copyFile(from, path.join(dest, file));
        }
      }
      return config;
    },
  ]);
}

module.exports = withBrandFonts;
