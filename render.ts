import { Task } from "./main.ts";
import { delay } from "@std/async/delay";
import { createMutex, type Mutex } from "@117/mutex";
import restoreCursor from "restore-cursor";
import process from "node:process";
import { stripVTControlCharacters } from "node:util";

restoreCursor();

export const list: Task[] = [];
export const mutex: Mutex = createMutex();
let prevLst: string = "";
/**
 * @returns `true` if any task is running.
 */
export async function render(): Promise<boolean> {
  let runningTasks = list.filter((task) => task.state === "started");
  const isLogIncomplete = runningTasks.length > 0;

  const lst = Task.sprintList();
  const stripLst = stripVTControlCharacters(lst);
  const changed = stripLst !== prevLst;
  const newLines = newLineCount(prevLst, process.stdout.columns);
  if (changed) {
    if (newLines > 0) process.stdout.write("\x1B[" + newLines + "F\x1B[J");
    process.stdout.write(lst);
    prevLst = stripLst;
  }
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

export function newLineCount(text: string, width: number): number {
  const lines = text.split("\n");
  let result = -1;
  for (const line of lines) {
    result += Math.ceil(line.length / width) || 1;
  }
  result = Math.max(0, result);
  return result;
}
