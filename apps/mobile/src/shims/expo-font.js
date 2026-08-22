/** JS stub: native ExpoFontLoader is excluded from the Android build. */
export function isLoaded() {
  return true;
}

export function isLoading() {
  return false;
}

export async function loadAsync() {}

export function processFontFamily(name) {
  return name;
}

export default {
  isLoaded,
  isLoading,
  loadAsync,
  processFontFamily,
};
