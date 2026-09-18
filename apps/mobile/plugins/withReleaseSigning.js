const { withAppBuildGradle } = require("expo/config-plugins");

const MARKER = "cubecontrolReleaseSigning";

const SNIPPET = `
// ${MARKER}: GitHub Actions sets CUBECONTROL_RELEASE_STORE_FILE.
def cubecontrolKs = System.getenv("CUBECONTROL_RELEASE_STORE_FILE")
if (cubecontrolKs != null && !cubecontrolKs.isEmpty() && file(cubecontrolKs).exists()) {
    android.signingConfigs.create("cubeRelease") {
        storeFile file(cubecontrolKs)
        storePassword System.getenv("CUBECONTROL_RELEASE_STORE_PASSWORD")
        keyAlias System.getenv("CUBECONTROL_RELEASE_KEY_ALIAS")
        keyPassword System.getenv("CUBECONTROL_RELEASE_KEY_PASSWORD")
    }
    android.buildTypes.release.signingConfig = android.signingConfigs.cubeRelease
}
`;

/** Sign assembleRelease with the CI keystore when env vars are present. */
function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") return config;
    if (config.modResults.contents.includes(MARKER)) return config;
    config.modResults.contents = `${config.modResults.contents.trimEnd()}\n${SNIPPET}`;
    return config;
  });
}

module.exports = withReleaseSigning;
