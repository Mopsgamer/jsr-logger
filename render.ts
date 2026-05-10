import { Task } from "./main.ts";
import { Semaphore } from "@std/async/unstable-semaphore";
import { delay } from "@std/async/delay";
import restoreCursor from "restore-cursor";
import process from "node:process";
import { createLogUpdate } from "log-update";

restoreCursor();

export const logu = createLogUpdate(process.stdout, { showCursor: false });

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
 * Clears all non-idle tasks from the task list.
 */
export function clearTasksExceptIdle(): void {
  for (let i = taskList.length - 1; i >= 0; i--) {
    if (taskList[i].state !== "idle") {
      taskList.splice(i, 1);
    }
  }
}

export function render(): void {
  const listString = Task.sprintList();
  logu(listString);
}

// const orig = console.log;
// console.log = (function (...args: any[]) {
//   const str = formatWithOptions({
//     colors: true,
//     depth: null,
//     showHidden: false,
//     showProxy: true,
//   }, ...args);
//   if (!isPending()) orig.call(console, ...args);
//   logu.persist(str);
// }).bind(console);

// deno-coverage-ignore-start
export async function renderer(): Promise<void> {
  const permit = mutex.tryAcquire();
  if (!permit) return;
  using _ = permit;
  while (isPending()) {
    const controller = new AbortController();
    const stateChange = new Promise<void>((resolve) => {
      const handler = () => {
        resolve();
        controller.abort();
      };

      for (const task of taskList) {
        task.addEventListener("statechange", handler, {
          once: true,
          signal: controller.signal,
        });
      }
    });

    await Promise.race([
      delay(1000 / 20),
      stateChange,
    ]);

    controller.abort();
    render();
  }

  render();
  clearTasksExceptIdle();
}
// deno-coverage-ignore-stop
