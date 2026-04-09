import { spawn } from "node:child_process";

const children = [];
let shuttingDown = false;

function run(name, command, args, env = process.env) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  });

  child.on("exit", (code) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    for (const current of children) {
      if (current !== child && !current.killed) {
        current.kill("SIGTERM");
      }
    }

    process.exit(code ?? 1);
  });

  children.push(child);
  console.log(`[pulsorclip] started ${name}`);
  return child;
}

const port = process.env.PORT || "10000";

run(
  "web",
  "npm",
  ["run", "start", "--workspace", "@pulsorclip/web", "--", "-p", port, "-H", "0.0.0.0"],
);

if (process.env.TELEGRAM_BOT_ENABLED !== "false" && process.env.TELEGRAM_BOT_TOKEN) {
  run("bot", "npm", ["run", "start", "--workspace", "@pulsorclip/bot"]);
} else {
  console.log("[pulsorclip] bot disabled or TELEGRAM_BOT_TOKEN not set, bot process skipped");
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    for (const child of children) {
      if (!child.killed) {
        child.kill(signal);
      }
    }

    process.exit(0);
  });
}
