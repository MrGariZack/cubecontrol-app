import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

function lanIp() {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) return addr.address;
    }
  }
  return null;
}

const ip = lanIp();
console.log("");
console.log("Metro por Wi-Fi — el 13R no necesita USB para recargar JS.");
console.log("PC y teléfono en la misma red. El cable solo para instalar un APK nuevo.");
if (ip) {
  console.log(`Si CubeControl pide servidor:  ${ip}:8081`);
} else {
  console.log("No hay IP LAN. Enciende el Wi-Fi del PC.");
}
console.log("");

const here = path.dirname(fileURLToPath(import.meta.url));
const child = spawn("npx", ["expo", "start", "--dev-client", "--lan"], {
  cwd: path.join(here, ".."),
  stdio: "inherit",
  shell: true,
});
child.on("exit", (code) => process.exit(code ?? 1));
