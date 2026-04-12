import { spawn } from "node:child_process";

type ProcessResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

type RunCommandOptions = {
  timeoutMs: number;
  idleTimeoutMs?: number;
  idleTimeoutMessage?: string;
  onStdoutLine?: (line: string) => void;
  onStderrLine?: (line: string) => void;
  signal?: AbortSignal;
};

function emitLines(
  chunk: string,
  buffer: string,
  onLine?: (line: string) => void,
) {
  const nextBuffer = buffer + chunk;
  const parts = nextBuffer.split(/\r?\n/);
  const remaining = parts.pop() || "";

  for (const part of parts) {
    if (part.trim()) {
      onLine?.(part);
    }
  }

  return remaining;
}

export async function runCommand(
  command: string,
  args: string[],
  timeoutOrOptions: number | RunCommandOptions,
): Promise<ProcessResult> {
  const options: RunCommandOptions =
    typeof timeoutOrOptions === "number"
      ? { timeoutMs: timeoutOrOptions }
      : timeoutOrOptions;

  let actualCommand = command;
  let actualArgs = [...args];

  // Automatic WSL wrapping for Linux paths on Windows
  // e.g. /usr/bin/ffmpeg or /mnt/f/path
  if (process.platform === "win32" && (command.startsWith("/") || command.startsWith("/mnt/"))) {
    actualCommand = "wsl";
    actualArgs = [command, ...args.map(arg => {
      if (typeof arg === "string" && (arg.includes(":\\") || arg.includes(":/"))) {
        // Convert Windows path to WSL path: F:\path -> /mnt/f/path
        return arg.replace(/^([a-zA-Z]):\\/, (_, drive) => `/mnt/${drive.toLowerCase()}/`).replace(/\\/g, "/");
      }
      return arg;
    })];
  }

  // Import logServer inside the function or use a custom logger if needed
  // For now let's use console.log to be safe if logServer isn't available
  if (process.env.PULSORCLIP_DEBUG_LOGS === "true") {
     console.log(JSON.stringify({
       level: "debug",
       event: "process.run",
       command: actualCommand,
       args: actualArgs,
       cwd: process.cwd()
     }));
  }

  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      return reject(new Error("Aborted"));
    }

    const child = spawn(actualCommand, actualArgs, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
      shell: process.platform === "win32",
    });

    const cleanup = () => {
      options.signal?.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      if (finished) return;
      finished = true;
      cleanup();
      clearIdleTimer();
      child.kill("SIGKILL");
      reject(new Error("Aborted"));
    };

    options.signal?.addEventListener("abort", onAbort);

    let stdout = "";
    let stderr = "";
    let stdoutRemainder = "";
    let stderrRemainder = "";
    let finished = false;
    let idleTimer: NodeJS.Timeout | null = null;

    const clearIdleTimer = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const resetIdleTimer = () => {
      if (!options.idleTimeoutMs) {
        return;
      }

      clearIdleTimer();
      idleTimer = setTimeout(() => {
        if (finished) {
          return;
        }

        finished = true;
        child.kill("SIGKILL");
        reject(new Error(options.idleTimeoutMessage || "Process stalled"));
      }, options.idleTimeoutMs);
    };

    const timer = setTimeout(() => {
      if (finished) {
        return;
      }

      finished = true;
      clearIdleTimer();
      child.kill("SIGKILL");
      reject(new Error("Process timed out"));
    }, options.timeoutMs);

    resetIdleTimer();

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      resetIdleTimer();
      stdoutRemainder = emitLines(text, stdoutRemainder, options.onStdoutLine);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      resetIdleTimer();
      stderrRemainder = emitLines(text, stderrRemainder, options.onStderrLine);
    });

    child.on("error", (error) => {
      if (finished) {
        return;
      }

      finished = true;
      cleanup();
      clearTimeout(timer);
      clearIdleTimer();
      reject(error);
    });

    child.on("close", (exitCode) => {
      if (finished) {
        return;
      }

      finished = true;
      cleanup();
      clearTimeout(timer);
      clearIdleTimer();

      if (stdoutRemainder.trim()) {
        options.onStdoutLine?.(stdoutRemainder.trim());
      }

      if (stderrRemainder.trim()) {
        options.onStderrLine?.(stderrRemainder.trim());
      }

      resolve({
        stdout,
        stderr,
        exitCode: exitCode ?? -1,
      });
    });
  });
}
