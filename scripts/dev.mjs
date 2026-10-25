import { spawn } from "node:child_process";
const args = process.argv.slice(2);
const index = args.lastIndexOf("--port");
const port = index >= 0 ? args[index + 1] : "3000";
if (args.includes("--strictPort")) {
  // Preview QA uses the same production export that is shipped in Docker.
  const { serve } = await import("./serve.mjs");
  serve(port);
} else {
  const child = spawn(
    process.execPath,
    [
      "node_modules/expo/bin/cli",
      "start",
      "--web",
      "--host",
      "lan",
      "--port",
      port,
    ],
    { stdio: "inherit", env: { ...process.env, EXPO_NO_TELEMETRY: "1" } },
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => child.kill(signal));
  child.on("exit", (code) => process.exit(code ?? 1));
}
