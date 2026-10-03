import process from "node:process";
import isInteractive from "is-interactive";
import { format } from "./main.ts";
import { isPending, isVisibleTask, logu, taskList } from "./render.ts";

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

const streamDecoders = new WeakMap<object, TextDecoder>();

function decodeStreamChunk(stream: object, chunk: Uint8Array): string {
  let decoder = streamDecoders.get(stream);
  if (!decoder) {
    decoder = new TextDecoder();
    streamDecoders.set(stream, decoder);
  }
  return decoder.decode(chunk, { stream: true });
}

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

function shouldHook(): boolean {
  return !hookState.isHooking &&
    (isPending() || (isInteractive() && taskList.some(isVisibleTask))) &&
    (isInteractive() || !!process.env.DEBUG);
}

function hookConsole(): void {
  const methods: (keyof Console)[] = ["log", "info", "warn", "error", "debug"];
  for (const method of methods) {
    const original = console[method];
    if (typeof original !== "function") continue;
    console[method] = (...args: unknown[]) => {
      if (!shouldHook()) {
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
  }
}

function hookNodeStreams(): void {
  for (const streamName of ["stdout", "stderr"] as const) {
    const stream = process[streamName];
    const originalWrite = stream.write;
    stream.write = (chunk: any, encoding?: any, callback?: any): boolean => {
      if (!shouldHook()) {
        return originalWrite.call(stream, chunk, encoding, callback);
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
  }
}

function hookDenoSyncStreams(): void {
  if (typeof Deno === "undefined") return;

  for (const streamName of ["stdout", "stderr"] as const) {
    const stdStream = Deno[streamName];
    if (!stdStream) continue;

    const origWrite = stdStream.write;
    stdStream.write = async (p: Uint8Array): Promise<number> => {
      if (!shouldHook()) {
        return await origWrite.call(stdStream, p);
      }
      hookState.isHooking = true;
      try {
        processChunk(decodeStreamChunk(stdStream, p));
      } finally {
        hookState.isHooking = false;
      }
      return p.length;
    };

    const origWriteSync = stdStream.writeSync;
    stdStream.writeSync = (p: Uint8Array): number => {
      if (!shouldHook()) {
        return origWriteSync.call(stdStream, p);
      }
      hookState.isHooking = true;
      try {
        processChunk(decodeStreamChunk(stdStream, p));
      } finally {
        hookState.isHooking = false;
      }
      return p.length;
    };
  }
}

function hookDenoWritableStreams(): void {
  if (typeof Deno === "undefined") return;

  for (const streamName of ["stdout", "stderr"] as const) {
    const streamObj = Deno[streamName];
    if (!streamObj) continue;

    const proto = Object.getPrototypeOf(streamObj);
    const desc = Object.getOwnPropertyDescriptor(proto, "writable") ||
      Object.getOwnPropertyDescriptor(streamObj, "writable");
    if (!desc || !desc.get) continue;

    const originalGetter = desc.get;
    const wrappedMap = new WeakMap<WritableStream, WritableStream>();

    Object.defineProperty(proto, "writable", {
      get() {
        const origWritable: WritableStream = originalGetter.call(this);
        if (wrappedMap.has(origWritable)) {
          return wrappedMap.get(origWritable)!;
        }

        const wrapped = new WritableStream({
          async write(chunk) {
            if (!shouldHook()) {
              const writer = origWritable.getWriter();
              try {
                await writer.write(chunk);
              } finally {
                writer.releaseLock();
              }
              return;
            }

            hookState.isHooking = true;
            try {
              const text = typeof chunk === "string"
                ? chunk
                : decodeStreamChunk(streamObj, chunk);
              processChunk(text);
            } finally {
              hookState.isHooking = false;
            }
          },
          async close() {},
          async abort() {},
        });

        wrappedMap.set(origWritable, wrapped);
        return wrapped;
      },
      configurable: true,
      enumerable: desc.enumerable,
    });
  }
}

/**
 * Sets up hooks for stdout and stderr to intercept output and persist it
 * using log-update when tasks are pending.
 */
export function setupHooks(): void {
  if (hookState.hooksSetup) return;
  hookState.hooksSetup = true;

  hookConsole();
  hookNodeStreams();
  hookDenoSyncStreams();
  hookDenoWritableStreams();
}

setupHooks();
