import process from "node:process";
import { isPending, logu } from "./render.ts";
import isInteractive from "is-interactive";
import { format } from "./main.ts";

/**
 * State for the hooking mechanism.
 */
export interface HookState {
  /**
   * Whether the library is currently hooking output.
   */
  isHooking: boolean;
  hooksSetup?: boolean;
}

/**
 * State for the hooking mechanism to prevent recursion.
 */
export const hookState: HookState = {
  isHooking: false,
};

export let pendingBuffer = "";

export function clearPendingBuffer(): void {
  pendingBuffer = "";
}

/**
 * Processes a chunk by appending it to the pending buffer.
 * If there are any complete lines, they are immediately persisted.
 */
export function processChunk(chunk: string): void {
  pendingBuffer += chunk;
  const lastNewlineIdx = Math.max(
    pendingBuffer.lastIndexOf("\n"),
    pendingBuffer.lastIndexOf("\r"),
  );
  if (lastNewlineIdx !== -1) {
    const completedPart = pendingBuffer.slice(0, lastNewlineIdx + 1);
    pendingBuffer = pendingBuffer.slice(lastNewlineIdx + 1);
    logu.persist(completedPart);
  }
}

/**
 * Flushes any remaining incomplete text in the pending buffer.
 */
export function flushPendingBuffer(): void {
  if (pendingBuffer.length > 0) {
    hookState.isHooking = true;
    try {
      logu.persist(pendingBuffer);
      pendingBuffer = "";
    } finally {
      hookState.isHooking = false;
    }
  }
}

/**
 * Sets up hooks for stdout and stderr to intercept output and persist it
 * using log-update when tasks are pending.
 */
export function setupHooks(): void {
  if (hookState.hooksSetup) return;
  hookState.hooksSetup = true;

  const check = () => isInteractive() || process.env.DEBUG;

  const wrapConsole = (method: keyof Console) => {
    const original = console[method];
    if (typeof original !== "function") return;
    console[method] = (...args: any[]) => {
      if (
        hookState.isHooking || !isPending() ||
        !check()
      ) {
        // deno-lint-ignore ban-types
        return (original as Function).apply(console, args);
      }
      hookState.isHooking = true;
      try {
        processChunk(format(...args) + "\n");
      } finally {
        hookState.isHooking = false;
      }
    };
  };

  wrapConsole("log");
  wrapConsole("info");
  wrapConsole("warn");
  wrapConsole("error");
  wrapConsole("debug");

  const originalStdoutWrite = process.stdout.write;
  process.stdout.write = (
    chunk: any,
    encoding?: any,
    callback?: any,
  ): boolean => {
    if (
      hookState.isHooking || !isPending() ||
      !check()
    ) {
      return originalStdoutWrite.call(
        process.stdout,
        chunk,
        encoding,
        callback,
      );
    }
    hookState.isHooking = true;
    try {
      processChunk(chunk.toString());
    } finally {
      hookState.isHooking = false;
    }
    if (typeof encoding === "function") encoding();
    if (typeof callback === "function") callback();
    return true;
  };

  const originalStderrWrite = process.stderr.write;
  process.stderr.write = (
    chunk: any,
    encoding?: any,
    callback?: any,
  ): boolean => {
    if (
      hookState.isHooking || !isPending() ||
      !check()
    ) {
      return originalStderrWrite.call(
        process.stderr,
        chunk,
        encoding,
        callback,
      );
    }
    hookState.isHooking = true;
    try {
      processChunk(chunk.toString());
    } finally {
      hookState.isHooking = false;
    }
    if (typeof encoding === "function") encoding();
    if (typeof callback === "function") callback();
    return true;
  };

  if (typeof Deno !== "undefined") {
    const originalDenoStdoutWrite = Deno.stdout.write;
    Deno.stdout.write = async (p: Uint8Array): Promise<number> => {
      if (
        hookState.isHooking || !isPending() ||
        !check()
      ) {
        return await originalDenoStdoutWrite.call(Deno.stdout, p);
      }
      hookState.isHooking = true;
      try {
        processChunk(new TextDecoder().decode(p));
      } finally {
        hookState.isHooking = false;
      }
      return p.length;
    };

    const originalDenoStdoutWriteSync = Deno.stdout.writeSync;
    Deno.stdout.writeSync = (p: Uint8Array): number => {
      if (
        hookState.isHooking || !isPending() ||
        !check()
      ) {
        return originalDenoStdoutWriteSync.call(Deno.stdout, p);
      }
      hookState.isHooking = true;
      try {
        processChunk(new TextDecoder().decode(p));
      } finally {
        hookState.isHooking = false;
      }
      return p.length;
    };

    const originalDenoStderrWrite = Deno.stderr.write;
    Deno.stderr.write = async (p: Uint8Array): Promise<number> => {
      if (
        hookState.isHooking || !isPending() ||
        !check()
      ) {
        return await originalDenoStderrWrite.call(Deno.stderr, p);
      }
      hookState.isHooking = true;
      try {
        processChunk(new TextDecoder().decode(p));
      } finally {
        hookState.isHooking = false;
      }
      return p.length;
    };

    const originalDenoStderrWriteSync = Deno.stderr.writeSync;
    Deno.stderr.writeSync = (p: Uint8Array): number => {
      if (
        hookState.isHooking || !isPending() ||
        !check()
      ) {
        return originalDenoStderrWriteSync.call(Deno.stderr, p);
      }
      hookState.isHooking = true;
      try {
        processChunk(new TextDecoder().decode(p));
      } finally {
        hookState.isHooking = false;
      }
      return p.length;
    };
  }
}
