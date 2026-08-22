import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const androidDir = path.join(root, "android");

function adbBin() {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || "";
  if (sdk) {
    return path.join(sdk, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
  }
  return "adb";
}

function adb(args) {
  return spawnSync(adbBin(), args, { encoding: "utf8" });
}

function dropGhostEmulators() {
  const listed = adb(["devices"]).stdout ?? "";
  for (const line of listed.split(/\r?\n/)) {
    const id = line.split(/\s+/)[0];
    if (id?.startsWith("emulator-")) adb(["disconnect", id]);
  }
}

function physicalSerial() {
  dropGhostEmulators();
  const listed = adb(["devices", "-l"]).stdout ?? "";
  for (const line of listed.split(/\r?\n/)) {
    if (!line.includes("\tdevice") && !line.includes(" device ")) continue;
    if (line.startsWith("emulator-")) continue;
    const id = line.split(/\s+/)[0];
    if (id && id !== "List") return id;
  }
  return null;
}

const serial = physicalSerial();
if (!serial) {
  console.error("No hay teléfono en adb. Activa depuración USB y vuelve a conectar el 13R.");
  process.exit(1);
}

if (!fs.existsSync(path.join(androidDir, "gradlew.bat")) && !fs.existsSync(path.join(androidDir, "gradlew"))) {
  console.error("Falta android/. Corre primero: pnpm exec expo prebuild --platform android");
  process.exit(1);
}

console.log(`Instalando en ${serial} (sin pasar por el detector de emuladores de Expo)`);
process.env.ANDROID_SERIAL = serial;

const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const gradle = spawn(
  gradlew,
  [
    "app:installDebug",
    "-x",
    "lint",
    "-x",
    "test",
    "--build-cache",
    "-PreactNativeArchitectures=arm64-v8a",
  ],
  { cwd: androidDir, stdio: "inherit", shell: true, env: process.env },
);

gradle.on("exit", (code) => {
  if (code !== 0) process.exit(code ?? 1);
  adb(["-s", serial, "shell", "am", "start", "-n", "com.tonehub.cubecontrol/.MainActivity"]);
  console.log("APK instalada. Arranca Metro con: pnpm start -- --dev-client");
  process.exit(0);
});
