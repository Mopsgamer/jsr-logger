import { Task } from "./main.ts";
import { delay } from "@std/async/delay";
import { createMutex, type Mutex } from "@117/mutex";
import restoreCursor from "restore-cursor";
import process from "node:process";
import { optimizedUpdate } from "./render-optimized.ts";

restoreCursor();

export const list: Task[] = [];
export const mutex: Mutex = createMutex();
let prevLst: string = "";
let prevUpdater: string = "";
/**
 * @returns `true` if any task is running.
 */
export async function render(): Promise<boolean> {
  let runningTasks = list.filter((task) => task.state === "started");
  const isLogIncomplete = runningTasks.length > 0;

  const lst = Task.sprintList();
  const { rows, columns } = process.stdout;
  const size = { rows, columns };
  const updaterString = optimizedUpdate(prevLst, lst, size);
  if (updaterString.length && prevUpdater !== updaterString) {
    process.stdout.write(updaterString);
    prevUpdater = updaterString;
  }
  prevLst = lst;
  return isLogIncomplete;
}

export let state = { noLoop: false };

// deno-coverage-ignore-start
export async function renderer(force = false) {
  if (state.noLoop && !force) return;
  await mutex.acquire();
  process.stdout.write("\x1B[?25l");
  for (; !state.noLoop;) {
    await delay(1000 / 60);
    if (!await render()) break;
  }
  await render();
  process.stdout.write("\x1B[?25h");
  list.length = 0;
  prevLst = "";
  mutex.release();
}
// deno-coverage-ignore-stop
