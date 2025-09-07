import isInteractive from "is-interactive";
import { Task } from "./main.ts";
import { delay } from "@std/async/delay";
import { createMutex, type Mutex } from "@117/mutex";
import process from "node:process";
import ansiRegex from "ansi-regex";

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
  const updaterString = optimizedUpdate(prevLst, lst, process.stdout);
  process.stdout.write(updaterString);
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

export function streamSize(columns: number, rows: number): StreamSize {
  return { columns, rows };
}

function getAnsiToken(text: string, charI: number): string | undefined {
  const sub = text.substring(charI)
  const ansiToken = ansiRegex().exec(sub)?.[0];
  if (ansiToken?.length && sub.startsWith(ansiToken)) {
    return ansiToken;
  }
}

export function splitNewLines(text: string, size: StreamSize): string[] {
  let line = "";
  const result: string[] = [];
  for (
    let charI = 0, visibleCharI = 0;
    charI < text.length;
    charI++, visibleCharI++
  ) {
    const char = text[charI];

    const ansiToken = getAnsiToken(text, charI);
    if (ansiToken) {
      visibleCharI = charI = charI + ansiToken.length;
      line += ansiToken;
      continue;
    }
    const reachedLimit = Math.floor(visibleCharI / (size.columns - 1)) >= 1;
    if (char === "\n" || reachedLimit) {
      line += char;
      result.push(line);
      line = "";
      visibleCharI = -1;
      continue;
    }
    line += char;
  }
  result.push(line);
  return result;
}

/**
 * Redraw without terminal flickering. This algorighm does not optimizes ansi motions.
 */
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

  let anyDiff = false;

  for (let rowI = linesOld.length - 1; rowI >= 0; rowI--) {
    let lineOld = linesOld[rowI], lineNew = linesNew?.[rowI];

    if (rowI > 0) {
      for (let nextRowI = rowI; nextRowI >= 0; nextRowI--) {
        lineOld = linesOld[nextRowI], lineNew = linesNew?.[nextRowI];
        if (
          nextRowI > 0 && lineNew === undefined || lineOld === lineNew || (nextRowI === linesOld.length - 1 && lineNew.startsWith(lineOld))
        ) {
          anyDiff = true;
          gotop++;
          continue;
        }
        rowI = nextRowI;
        break;
      }
    }

    if (gotop > 0) {
      const diff = gotop;
      result += "\x1B[" + diff + "F";
    }

    using _gotopZero = {
      [Symbol.dispose]() {
        gotop = 0;
      },
    };

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

    if (gotop === 0 && !(lineOld === lineNew || (rowI === linesOld.length - 1 && lineNew.startsWith(lineOld)))) {
      result += "\x1B[0G";
    }

    let goright = 0;
    for (
      let colIOld = 0, colINew = 0;
      colIOld < lineOld.length;
      colIOld++, colINew++
    ) {
      // const ansiTokenOld = getAnsiToken(lineOld, colIOld);
      // if (ansiTokenOld) { // skip old string ansi
      //   colIOld = colIOld + ansiTokenOld.length;
      //   colINew--; // keep when continue
      // }
      // const ansiTokenNew = getAnsiToken(lineNew, colINew);
      // if (ansiTokenNew) { // put new string ansi
      //   result += ansiTokenNew
      //   colINew = colINew + ansiTokenNew.length;
      //   colIOld--; // keep when continue
      // }
      const charOld = lineOld[colIOld], charNew = lineNew?.[colINew];
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

    const gorightNotUseless = lineOld.substring(lineOld.length - goright) !==
      lineNew.substring(lineOld.length - goright);
    if (goright > 0 && gorightNotUseless) {
      result += "\x1B[" + goright + "C";
      continue;
    }
  }

  if (textNew.length > textOld.length) {
    if (anyDiff) {
      result = "\x1B[s" + result + "\x1B[u";
    }
    result += textNew.substring(textOld.length);
  }

  return result;
}
