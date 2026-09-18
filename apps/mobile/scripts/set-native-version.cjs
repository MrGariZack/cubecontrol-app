#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const versionName = process.argv[2];
const versionCode = Number(process.argv[3]);
if (!versionName || !Number.isInteger(versionCode) || versionCode < 1) {
  console.error("usage: set-native-version.cjs <versionName> <versionCode>");
  process.exit(1);
}

const appJsonPath = path.join(__dirname, "..", "app.json");
const app = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
app.expo.version = versionName;
app.expo.android = app.expo.android ?? {};
app.expo.android.versionCode = versionCode;
fs.writeFileSync(appJsonPath, `${JSON.stringify(app, null, 2)}\n`);
console.log(`android versionName=${versionName} versionCode=${versionCode}`);
