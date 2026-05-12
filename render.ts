import { Task } from "./main.ts";
import { Semaphore } from "@std/async/unstable-semaphore";
import { delay } from "@std/async/delay";
import process from "node:process";
import { createLogUpdate } from "log-update";
import isInteractive from "is-interactive";
import { hookState, setupHooks } from "./hook.ts";

declare global {
  var __FORCE_RENDER__: boolean | undefined;
  var __RENDERER_TIMEOUT__: number | undefined;
  var __DISABLE_RENDERER_LOOP__: boolean | undefined;
}

function show(): void {
  process.stderr.write("\x1B[?25h");
}

process.on("exit", show);
process.on("SIGINT", () => {
  show();
  process.exit(130);
});
process.on("SIGTERM", () => {
  show();
  process.exit(143);
});
process.on("uncaughtException", (err) => {
  show();
  throw err;
});

/**
 * The log-update instance used for interactive terminal rendering.
 */
export const logu = createLogUpdate(process.stdout, { showCursor: false });
setupHooks();

/**
 * The list of all tasks.
 */
export const taskList: Task[] = [];
/**
 * A semaphore used to ensure that only one render loop is running at a time.
 */
export const mutex: Semaphore = new Semaphore(1);

let lastActivity = 0;

/**
 * Updates the last activity timestamp to keep the renderer alive.
 */
export function activity(): void {
  lastActivity = Date.now();
}

/**
 * Returns true if there are any tasks that are currently in the "started" state.
 */
export function isPending(): boolean {
  const shouldRedraw = taskList.some(
    (task) => task.state === "started",
  );
  return shouldRedraw;
}

/**
 * Clears all tasks that have reached an end state.
 */
export function clearTasksExceptIdle(): void {
  for (let i = taskList.length - 1; i >= 0; i--) {
    const state = taskList[i].state;
    if (state !== "idle" && state !== "started") {
      taskList.splice(i, 1);
    }
  }
}

/**
 * Renders the current list of tasks to the terminal.
 */
export function render(): void {
  const listString = Task.sprintList();
  if (isInteractive() || process.env.DEBUG) {
    hookState.isHooking = true;
    logu(listString);
    hookState.isHooking = false;
  } else {
    if (globalThis.__FORCE_RENDER__) {
      process.stdout.write(listString);
    }
    // In non-interactive mode, Task.start() and Task.end() already print.
  }
}

// deno-coverage-ignore-start
/**
 * The main render loop.
 * @returns A promise that resolves when the render loop has finished.
 */
export async function renderer(): Promise<void> {
  const permit = mutex.tryAcquire();
  if (!permit) return;
  using _ = permit;

  const timeout = globalThis.__RENDERER_TIMEOUT__ ?? 2000;

  try {
    if (isInteractive() || process.env.DEBUG) {
      while (true) {
        const pending = isPending();
        const now = Date.now();
        const inactiveTime = now - lastActivity;

        if (!pending && inactiveTime >= timeout) {
          break;
        }

        if (globalThis.__DISABLE_RENDERER_LOOP__) break;

        await delay(1000 / 20);
        render();
      }
    }

    render();
    clearTasksExceptIdle();
  } finally {
    logu.done();
  }
}
// deno-coverage-ignore-stop
