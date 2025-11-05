import { Task } from "./main.ts";
import { delay } from "@std/async/delay";
import { createMutex, type Mutex } from "@117/mutex";
import restoreCursor from "restore-cursor";
import process from "node:process";
import { stripVTControlCharacters } from "node:util";

restoreCursor();

export const taskList: Task[] = [];
export const mutex: Mutex = createMutex();
let previousListString: string = "";

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
  const listStringNoVT = stripVTControlCharacters(listString);
  const changed = listStringNoVT !== previousListString;
  const newLines = newLineCount(previousListString, process.stdout.columns);
  if (changed) {
    if (newLines > 0) process.stdout.write("\x1B[" + newLines + "F\x1B[J");
    process.stdout.write(listString);
    previousListString = listStringNoVT;
  }
}

export let state = { noLoop: false };

// deno-coverage-ignore-start
export async function renderer(force = false): Promise<void> {
  if (state.noLoop && !force) return;
  await mutex.acquire();
  process.stdout.write("\x1B[?25l");
  for (; !state.noLoop;) {
    await delay(1000 / 60);
    render();
    if (!isPending()) break;
  }
  render();
  process.stdout.write("\x1B[?25h");
  clearTasksExceptIdle();
  previousListString = "";
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
