import { Task } from "./main.ts";
import { Semaphore } from "@std/async/unstable-semaphore";
import { delay } from "@std/async/delay";
import process from "node:process";
import { createLogUpdate } from "log-update";
import isInteractive from "is-interactive";
import { flushPendingBuffer, hookState, pendingBuffer, setupHooks } from "./hook.ts";

function show(): void {
  process.stderr.write("\x1B[?25h");
}

/**
 * The log-update instance used for interactive terminal rendering.
 */
export const logu = createLogUpdate(process.stdout, { showCursor: false });

function cleanup(): void {
  hookState.isHooking = true;
  taskList.length = 0;
  // logu.clear(); // we don't want to remove the print
  flushPendingBuffer();
  hookState.isHooking = false;
}

process.on("exit", show);
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});
process.on("uncaughtException", (err) => {
  cleanup();
  show();
  throw err;
});
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
export function clearSettledTasks(): void {
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
  let listString = Task.sprintList();
  if (pendingBuffer) {
    listString = pendingBuffer + "\n" + listString;
  }
  if (listString === "") return;
  if (isInteractive() || process.env.DEBUG) {
    hookState.isHooking = true;
    logu(listString);
    hookState.isHooking = false;
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

  const timeout = 2000;

  try {
    if (isInteractive() || process.env.DEBUG) {
      while (true) {
        const pending = isPending();
        const now = Date.now();
        const inactiveTime = now - lastActivity;

        if (!pending && inactiveTime >= timeout) {
          break;
        }

        await delay(1000 / 20);
        render();
      }
    }

    render();
    clearSettledTasks();
  } finally {
    flushPendingBuffer();
    logu.done();
  }
}
// deno-coverage-ignore-stop
