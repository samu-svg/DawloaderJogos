import { execFileSync } from "node:child_process";
import path from "node:path";
import { app } from "electron";

export const PROTOCOL = "montahd";

/** Comando do handler com `"%1"` entre aspas — sem isso o Windows parte `&`. */
export function windowsProtocolOpenCommand(exePath: string): string {
  return `"${path.resolve(exePath)}" "%1"`;
}

function registerQuotedWindowsProtocol(exePath: string): void {
  const exe = path.resolve(exePath);
  const command = windowsProtocolOpenCommand(exe);
  const icon = `${exe},0`;
  const runs: string[][] = [
    ["add", "HKCU\\Software\\Classes\\montahd", "/ve", "/t", "REG_SZ", "/d", "URL:MontaHD Protocol", "/f"],
    ["add", "HKCU\\Software\\Classes\\montahd", "/v", "URL Protocol", "/t", "REG_SZ", "/d", "", "/f"],
    ["add", "HKCU\\Software\\Classes\\montahd\\DefaultIcon", "/ve", "/t", "REG_SZ", "/d", icon, "/f"],
    ["add", "HKCU\\Software\\Classes\\montahd\\shell\\open\\command", "/ve", "/t", "REG_SZ", "/d", command, "/f"],
  ];
  for (const args of runs) {
    execFileSync("reg", args, { windowsHide: true, stdio: "ignore" });
  }
}

export function registerProtocolClient() {
  if (process.platform === "win32" && app.isPackaged) {
    try {
      registerQuotedWindowsProtocol(process.execPath);
      return;
    } catch {
      // cai no registro padrão do Electron
    }
  }

  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
        path.resolve(process.argv[1]),
      ]);
      return;
    }
  }

  app.setAsDefaultProtocolClient(PROTOCOL);
}
