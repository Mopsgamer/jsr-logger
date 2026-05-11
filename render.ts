import {
  type DefaultTaskOptions,
  type format,
  type LoggerOptions,
  type sprintLevel,
  type sprintTask,
  type startRunner,
  type SubtaskOptions,
  Task,
  type TaskOptions,
} from "./main.ts";
import { Semaphore } from "@std/async/unstable-semaphore";
import { delay } from "@std/async/delay";
import restoreCursor from "restore-cursor";
import process from "node:process";
import { createLogUpdate } from "log-update";
import isInteractive from "is-interactive";
import { hookState, setupHooks } from "./hook.ts";

restoreCursor();

export const logu = createLogUpdate(process.stdout, { showCursor: false });
setupHooks();

export const taskList: Task[] = [];
export const mutex: Semaphore = new Semaphore(1);

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

export function render(): void {
  const listString = Task.sprintList();
  if (isInteractive() || process.env.DEBUG) {
    hookState.isHooking = true;
    logu(listString);
    hookState.isHooking = false;
  } else {
    // @ts-ignore
    if (globalThis.__FORCE_RENDER__) {
      process.stdout.write(listString);
    }
    // In non-interactive mode, Task.start() and Task.end() already print.
  }
}

// deno-coverage-ignore-start
export async function renderer(): Promise<void> {
  const permit = mutex.tryAcquire();
  if (!permit) return;
  using _ = permit;

  if (isInteractive() || process.env.DEBUG) {
    while (isPending()) {
      // @ts-ignore
      if (globalThis.__DISABLE_RENDERER_LOOP__) break;
      await delay(1000 / 20);
      render();
    }
  }

  render();
  clearTasksExceptIdle();
}
// deno-coverage-ignore-stop
