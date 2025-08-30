import isInteractive from "is-interactive";
import { Task } from "./main.ts";
import { delay } from "@std/async/delay";
import { createMutex, type Mutex } from "@117/mutex";
import process from "node:process";
import { stripVTControlCharacters } from "node:util";

export const list: Task[] = [];
export const mutex: Mutex = createMutex();
let prevLst: string = "";
let loggedTasksStarted = new Set<Task>();
let loggedTasks = new Set<Task>();
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
/**
 * @returns `true` if any task is running.
 */
export async function renderCI(): Promise<boolean> {
  for (const task of list) {
    if (task.state === "idle") continue;
    if (task.state === "started") {
      if (loggedTasksStarted.has(task)) continue;
      loggedTasksStarted.add(task);
    } else {
      if (loggedTasks.has(task)) continue;
      loggedTasks.add(task);
    }

    process.stdout.write(task.sprint() + "\n");
  }
  const isLogIncomplete = list.every((task) =>
    loggedTasks.has(task) && loggedTasksStarted.has(task)
  );
  return isLogIncomplete;
}

export let state = { noLoop: false };

export async function renderer(force = false) {
  if (state.noLoop && !force) return;
  // deno-coverage-ignore
  const draw = () => isInteractive() ? render() : renderCI();
  await mutex.acquire();
  process.stdout.write("\x1B[?25l");
  for (;;) {
    await delay(1000 / 60);
    if (!await draw()) break;
  }
  await draw();
  process.stdout.write("\x1B[?25h");
  list.length = 0;
  prevLst = "";
  loggedTasks.clear();
  loggedTasksStarted.clear();
  mutex.release();
}

export function newLineCount(text: string, width: number): number {
  const lines = text.split("\n");
  let result = -1;
  for (const line of lines) {
    result += Math.ceil(line.length / width) || 1;
  }
  result = Math.max(0, result);
  return result;
}
