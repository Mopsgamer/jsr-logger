import isInteractive from "is-interactive";
import { Task } from "./main.ts";
import { delay } from "@std/async/delay";
import { createMutex, type Mutex } from "@117/mutex";
import process from "node:process";
import ansiRegex from "ansi-regex"

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
  process.stdout.write(optimizedUpdate(prevLst, lst, process.stdout));
  prevLst = lst;
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

export type StreamSize = { columns: number; rows: number };

export function countNewLines(text: string, size: StreamSize): number {
  const lines = text.split("\n");
  let result = -1;
  for (const line of lines) {
    result += Math.ceil(line.length / size.columns) || 1;
  }
  result = Math.max(0, result);
  return result;
}

export function splitNewLines(text: string, size: StreamSize): string[] {
  let line = "";
  const result: string[] = [];
  for (
    let charI = 0, visibleCharI = 0;
    charI < text.length;
  ) {
    const char = text[charI];

    const regex = new RegExp("^" + ansiRegex().source);
    const ansiToken = regex.exec(text.substring(charI))?.[0];
    if (ansiToken) {
      visibleCharI = charI = charI + ansiToken.length + 1;
      line += ansiToken;
      continue;
    }
    const reachedLimit = Math.floor(visibleCharI / (size.columns - 1)) >= 1;
    if (char === "\n" || reachedLimit) {
      line += char;
      result.push(line);
      line = "";
      visibleCharI = 0;
      charI++;
      continue;
    }
    line += char;
    charI++;
    visibleCharI++;
  }
  result.push(line);
  return result;
}

export function optimizedUpdate(
  textOld: string,
  textNew: string,
  size: StreamSize,
): string {
  if (textNew.startsWith(textOld)) {
    return textNew.substring(textOld.length);
  }

  let result = "";

  const linesOld = splitNewLines(textOld, size),
    linesNew = splitNewLines(textNew, size);

  let gotop = 0;

  for (let rowI = linesOld.length - 1; rowI >= 0; rowI--) {
    let lineOld = linesOld[rowI], lineNew = linesNew[rowI];

    if (rowI > 0) for (let nextRowI = rowI; nextRowI >= 0; nextRowI--) {
      lineOld = linesOld[nextRowI], lineNew = linesNew?.[nextRowI];
      // if not changed or should go up
      if (nextRowI > 0 && lineOld === lineNew || lineNew === undefined) {
        gotop++;
        continue;
      }
      rowI = nextRowI;
      break
    }

    if (gotop > 0) {
      const diff = gotop;
      result += "\x1B[" + diff + "F";
      gotop = 0;
    }

    const isLastLineNewButOldIsBigger = linesNew.length < linesOld.length &&
      linesOld.length - (linesOld.length - linesNew.length) - rowI - 1 <= 0;
    if (isLastLineNewButOldIsBigger) {
      result += "\x1B[" + lineNew.length + "C" + "\x1B[J";
      break;
    }

    if (lineNew === undefined) {
      result += "\x1B[J";
      break;
    }

    let goright = 0;
    for (let colI = 0; colI < lineOld.length; colI++) {
      if (colI === 0 && !/\x1B\[\d+F$/.test(result)) result += "\x1B[0G";
      const charOld = lineOld[colI], charNew = lineNew?.[colI];
      if (charNew === undefined) {
        result += isLastLineNewButOldIsBigger ? "\x1B[J" : "\x1B[0K";
        break;
      }
      if (charOld === charNew) {
        goright++;
        continue;
      }
      if (goright > 0) {
        result += "\x1B[" + goright + "C";
      }
      result += charNew;
      goright = 0;
    }

    if (goright > 0) {
      result += "\x1B[" + goright + "C";
    }
  }

  if (textNew.length > textOld.length) {
    result += textNew.substring(textOld.length);
  }

  return result;
}
