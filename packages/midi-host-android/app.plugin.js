const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
} = require("expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

/** CUBE Baby USB VID 0x301A / PID 0x5555 (decimal for device_filter.xml). */
const CUBE_BABY_VENDOR_ID = 0x301a;
const CUBE_BABY_PRODUCT_ID = 0x5555;
const USB_DEVICE_ATTACHED = "android.hardware.usb.action.USB_DEVICE_ATTACHED";
const FILTER_FILE = "cube_baby_usb_device_filter.xml";

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function ensureUsesFeature(manifest, name, required) {
  const features = asArray(manifest["uses-feature"]);
  const exists = features.some((feature) => feature?.$?.["android:name"] === name);
  if (!exists) {
    features.push({
      $: {
        "android:name": name,
        "android:required": required ? "true" : "false",
      },
    });
  }
  manifest["uses-feature"] = features;
}

function ensureUsbAttachIntent(activity) {
  const filters = asArray(activity["intent-filter"]);
  const hasUsb = filters.some((filter) =>
    asArray(filter.action).some((action) => action?.$?.["android:name"] === USB_DEVICE_ATTACHED),
  );
  if (!hasUsb) {
    filters.push({
      action: [{ $: { "android:name": USB_DEVICE_ATTACHED } }],
    });
  }
  activity["intent-filter"] = filters;

  const meta = asArray(activity["meta-data"]);
  const hasMeta = meta.some((item) => item?.$?.["android:name"] === USB_DEVICE_ATTACHED);
  if (!hasMeta) {
    meta.push({
      $: {
        "android:name": USB_DEVICE_ATTACHED,
        "android:resource": "@xml/cube_baby_usb_device_filter",
      },
    });
  }
  activity["meta-data"] = meta;
}

function withCubeBabyUsbManifest(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const manifest = androidManifest.manifest;
    ensureUsesFeature(manifest, "android.hardware.usb.host", false);
    ensureUsesFeature(manifest, "android.software.midi", false);

    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(androidManifest);
    ensureUsbAttachIntent(activity);
    return config;
  });
}

function withCubeBabyDeviceFilter(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const xmlDir = path.join(config.modRequest.platformProjectRoot, "app/src/main/res/xml");
      await fs.promises.mkdir(xmlDir, { recursive: true });
      const xml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <usb-device vendor-id="${CUBE_BABY_VENDOR_ID}" product-id="${CUBE_BABY_PRODUCT_ID}" />
    <usb-device vendor-id="${CUBE_BABY_VENDOR_ID}" />
</resources>
`;
      await fs.promises.writeFile(path.join(xmlDir, FILTER_FILE), xml, "utf8");
      return config;
    },
  ]);
}

/**
 * Expo config plugin: USB-OTG attach intent + CUBE Baby device_filter (VID 301A).
 * Native MidiManager lives in the Android Expo module; this only mutates the app manifest.
 */
function withMidiHostAndroid(config) {
  const withMic = AndroidConfig.Permissions.withPermissions(config, [
    "android.permission.RECORD_AUDIO",
  ]);
  return withCubeBabyDeviceFilter(withCubeBabyUsbManifest(withMic));
}

module.exports = withMidiHostAndroid;
