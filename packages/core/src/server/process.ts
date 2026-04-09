import { spawn } from "node:child_process";

type ProcessResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

type RunCommandOptions = {
  timeoutMs: number;
  onStdoutLine?: (line: string) => void;
  onStderrLine?: (line: string) => void;
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

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let stdoutRemainder = "";
    let stderrRemainder = "";
    let finished = false;

    const timer = setTimeout(() => {
      if (finished) {
        return;
      }

      finished = true;
      child.kill("SIGKILL");
      reject(new Error("Process timed out"));
    }, options.timeoutMs);

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      stdoutRemainder = emitLines(text, stdoutRemainder, options.onStdoutLine);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      stderrRemainder = emitLines(text, stderrRemainder, options.onStderrLine);
    });

    child.on("error", (error) => {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (exitCode) => {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timer);

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
