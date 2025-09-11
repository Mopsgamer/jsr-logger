import ansiRegex from "ansi-regex";
import { stripVTControlCharacters } from "node:util";

export type StreamSize = { columns: number; rows: number };

export function streamSize(columns: number, rows: number): StreamSize {
  return { columns, rows };
}

type AnsiState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  blink: boolean;
  inverse: boolean;
  strikethrough: boolean;
  color: string;
  background: string;
};

const defstate: AnsiState = {
  bold: false,
  italic: false,
  underline: false,
  blink: false,
  inverse: false,
  strikethrough: false,
  color: "",
  background: "",
};

function ansiStateCompare(a: AnsiState, b: AnsiState): boolean {
  return a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.blink === b.blink &&
    a.inverse === b.inverse &&
    a.strikethrough === b.strikethrough &&
    a.color === b.color &&
    a.background === b.background;
}

function getAnsiToken(text: string, charI: number): string | undefined {
  const sub = text.substring(charI);
  const ansiToken = ansiRegex().exec(sub);
  const token = ansiToken?.[0];
  if (token?.length && sub.startsWith(token)) {
    return token;
  }
}

function getAnsiState(state: AnsiState, token: string): void {
  const sgrMatch = /\x1b\[([0-9;]*)m/i.exec(token);
  if (!sgrMatch) return;

  const codes = sgrMatch[1] ? sgrMatch[1].split(";").map(Number) : [0];

  for (const code of codes) {
    switch (code) {
      case 0: // reset
        Object.assign(state, defstate);
        break;
      case 1:
        state.bold = true;
        break;
      case 3:
        state.italic = true;
        break;
      case 4:
        state.underline = true;
        break;
      case 5:
        state.blink = true;
        break;
      case 7:
        state.inverse = true;
        break;
      case 9:
        state.strikethrough = true;
        break;
      case 22:
        state.bold = false;
        break;
      case 23:
        state.italic = false;
        break;
      case 24:
        state.underline = false;
        break;
      case 25:
        state.blink = false;
        break;
      case 27:
        state.inverse = false;
        break;
      case 29:
        state.strikethrough = false;
        break;
      default:
        if (30 <= code && code <= 37) {
          state.color = `color${code}`;
        } else if (90 <= code && code <= 97) {
          state.color = `brightColor${code}`;
        } else if (40 <= code && code <= 47) {
          state.background = `bgColor${code}`;
        } else if (100 <= code && code <= 107) {
          state.background = `brightBgColor${code}`;
        }
        break;
    }
  }
}

function getFinalAnsiState(text: string): AnsiState {
  const state: AnsiState = { ...defstate };
  for (
    let charI = 0;
    charI < text.length;
    charI++
  ) {
    const ansiToken = getAnsiToken(text, charI);
    if (ansiToken) {
      charI = charI + ansiToken.length - 1;
      getAnsiState(state, ansiToken);
    }
  }
  return state;
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
      charI = charI + ansiToken.length - 1;
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
  if (line.length) {
    result.push(line);
  }
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

  if (stripVTControlCharacters(textOld).length === 0) {
    return textNew;
  }

  if (stripVTControlCharacters(textNew).length === 0) {
    return "";
  }

  let result = "";

  const linesOld = splitNewLines(textOld, size),
    linesNew = splitNewLines(textNew, size);

  let gotop = 0;
  let isCursorSaved = false;

  const linesOldLast = linesOld.length - 1;
  const isLastLineStartsSame = linesNew[linesOldLast]?.startsWith(
    linesOld[linesOldLast],
  );

  let ansiStateNew: AnsiState = getFinalAnsiState(textOld);
  let ansiStateOld: AnsiState = { ...ansiStateNew };

  LinesLoop: for (let lineI = linesOldLast; lineI >= 0; lineI--) {
    let lineOld = linesOld[lineI], lineNew = linesNew?.[lineI];

    if (lineNew === undefined || lineNew.startsWith(lineOld)) {
      gotop++;
      continue;
    }

    let didGotop = false;
    if (gotop > 0) {
      isCursorSaved = true;
      result += "\x1B[" + gotop + "F";
      didGotop = true;
      gotop = 0;
    }

    if (lineNew === undefined) {
      result += "\x1B[J";
      break;
    }

    if (!didGotop && !isLastLineStartsSame) {
      result += "\x1B[0G";
    }

    let goright = 0;
    const charInitialI = Math.max(lineOld.length, lineNew.length);
    CharsLoop: for (
      let charOldI = 0, charNewI = 0;
      charOldI < charInitialI;
      charOldI++, charNewI++
    ) {
      const charOld = lineOld[charOldI];
      if (charOld === undefined) {
        if (goright > 0) {
          result += "\x1B[" + goright + "C";
        }
        goright = 0;
        result += lineNew.slice(charNewI);
        break CharsLoop;
      }
      const ansiTokenNew = getAnsiToken(lineNew, charNewI);
      if (ansiTokenNew) { // put new string ansi
        result += ansiTokenNew;
        charNewI = charNewI + ansiTokenNew.length - 1;
        charOldI--; // keep when continue
        getAnsiState(ansiStateNew, ansiTokenNew);
        continue CharsLoop;
      }
      const ansiTokenOld = getAnsiToken(lineOld, charOldI);
      if (ansiTokenOld) { // skip old string ansi
        charOldI = charOldI + ansiTokenOld.length - 1;
        charNewI--; // keep when continue
        getAnsiState(ansiStateOld, ansiTokenOld);
        continue CharsLoop;
      }
      const charNew = lineNew?.[charNewI];
      if (charNew === undefined) {
        if (goright > 0) {
          result += "\x1B[" + goright + "C";
        }
        if (linesNew.length < linesOld.length && lineI >= linesNew.length - 1) {
          result += "\x1B[J";
          isCursorSaved = false;
          break LinesLoop;
        }
        result += "\x1B[K";
        break CharsLoop;
      }
      if (
        charOld === charNew && ansiStateNew &&
        ansiStateCompare(ansiStateOld, ansiStateNew)
      ) {
        goright++;
        continue CharsLoop;
      }
      if (goright > 0) {
        result += "\x1B[" + goright + "C";
      }
      result += charNew;
      goright = 0;
    }
  }

  if (isCursorSaved) {
    result = "\x1B[s" + result + "\x1B[u";
  }
  if (isLastLineStartsSame) {
    result += linesNew[linesOldLast].slice(linesOld[linesOldLast].length);
  }
  result += linesNew.slice(linesOld.length).join("");

  return result;
}
