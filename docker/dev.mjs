import { spawn } from "node:child_process";

const children = [];
let shuttingDown = false;

function run(name, command, args, env = process.env) {
  let restartCount = 0;

  function spawnChild() {
    const child = spawn(command, args, {
      stdio: "inherit",
      env,
      shell: process.platform === "win32",
    });

    child.on("exit", (code) => {
      if (shuttingDown) {
        return;
      }

      console.error(`[pulsorclip] ${name} exited with code ${code}.`);

      if (name === "web") {
        // Server expects the main process to exit if the web server fails,
        // but since we want auto-restart, we'll only exit if it's a fatal shutdown.
        // However, if it crashed, we restart it.
        console.log(`[pulsorclip] restarting ${name} in 5s... (attempt ${++restartCount})`);
        setTimeout(spawnChild, 5000);
      } else {
        console.log(`[pulsorclip] restarting ${name} in 5s... (attempt ${++restartCount})`);
        setTimeout(spawnChild, 5000);
      }
    });

    const index = children.findIndex(c => c.name === name);
    if (index !== -1) {
      children[index].child = child;
    } else {
      children.push({ name, child });
    }

    console.log(`[pulsorclip] started ${name}`);
    return child;
  }

  return spawnChild();
}

const port = process.env.PORT || "10000";

run(
  "web",
  "npm",
  ["run", "dev", "--workspace", "@pulsorclip/web", "--", "-p", port, "-H", "0.0.0.0"],
);

if (process.env.TELEGRAM_BOT_ENABLED !== "false" && process.env.TELEGRAM_BOT_TOKEN) {
  run("bot", "npm", ["run", "dev", "--workspace", "@pulsorclip/bot"]);
} else {
  console.log("[pulsorclip] bot disabled or TELEGRAM_BOT_TOKEN not set, bot process skipped");
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    for (const item of children) {
      if (item.child && !item.child.killed) {
        item.child.kill(signal);
      }
    }

    process.exit(0);
  });
}
