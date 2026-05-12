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
  __DISABLE_HOOKS__?: boolean;
  __LOGGER_HOOKS_SETUP__?: boolean;
}

/**
 * State for the hooking mechanism to prevent recursion.
 */
export const hookState: HookState = {
  isHooking: false,
};

/**
 * Sets up hooks for stdout and stderr to intercept output and persist it
 * using log-update when tasks are pending.
 */
export function setupHooks(force: boolean = false): void {
  if (hookState.__LOGGER_HOOKS_SETUP__ && !force) return;
  hookState.__LOGGER_HOOKS_SETUP__ = true;

  const check = () => isInteractive() || process.env.DEBUG || force;

  const wrapConsole = (method: keyof Console) => {
    const original = console[method];
    if (typeof original !== "function") return;
    console[method] = (...args: any[]) => {
      if (
        hookState.isHooking || !isPending() || hookState.__DISABLE_HOOKS__ ||
        !check()
      ) {
        return (original as Function).apply(console, args);
      }
      hookState.isHooking = true;
      try {
        logu.persist(format(...args) + "\n");
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
      hookState.isHooking || !isPending() || hookState.__DISABLE_HOOKS__ ||
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
      logu.persist(chunk.toString());
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
      hookState.isHooking || !isPending() || hookState.__DISABLE_HOOKS__ ||
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
      logu.persist(chunk.toString());
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
        hookState.isHooking || !isPending() || hookState.__DISABLE_HOOKS__ ||
        !check()
      ) {
        return await originalDenoStdoutWrite.call(Deno.stdout, p);
      }
      hookState.isHooking = true;
      try {
        logu.persist(new TextDecoder().decode(p));
      } finally {
        hookState.isHooking = false;
      }
      return p.length;
    };

    const originalDenoStdoutWriteSync = Deno.stdout.writeSync;
    Deno.stdout.writeSync = (p: Uint8Array): number => {
      if (
        hookState.isHooking || !isPending() || hookState.__DISABLE_HOOKS__ ||
        !check()
      ) {
        return originalDenoStdoutWriteSync.call(Deno.stdout, p);
      }
      hookState.isHooking = true;
      try {
        logu.persist(new TextDecoder().decode(p));
      } finally {
        hookState.isHooking = false;
      }
      return p.length;
    };

    const originalDenoStderrWrite = Deno.stderr.write;
    Deno.stderr.write = async (p: Uint8Array): Promise<number> => {
      if (
        hookState.isHooking || !isPending() || hookState.__DISABLE_HOOKS__ ||
        !check()
      ) {
        return await originalDenoStderrWrite.call(Deno.stderr, p);
      }
      hookState.isHooking = true;
      try {
        logu.persist(new TextDecoder().decode(p));
      } finally {
        hookState.isHooking = false;
      }
      return p.length;
    };

    const originalDenoStderrWriteSync = Deno.stderr.writeSync;
    Deno.stderr.writeSync = (p: Uint8Array): number => {
      if (
        hookState.isHooking || !isPending() || hookState.__DISABLE_HOOKS__ ||
        !check()
      ) {
        return originalDenoStderrWriteSync.call(Deno.stderr, p);
      }
      hookState.isHooking = true;
      try {
        logu.persist(new TextDecoder().decode(p));
      } finally {
        hookState.isHooking = false;
      }
      return p.length;
    };
  }
}
