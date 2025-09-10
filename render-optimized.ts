import ansiRegex from "ansi-regex";

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

  let result = "";

  const linesOld = splitNewLines(textOld, size),
    linesNew = splitNewLines(textNew, size);

  let gotop = 0;
  let isCursorSaved = false;

  const firstRowI = linesOld.length - 1;
  let rowI = firstRowI;
  const isLastLineStartsSame = linesNew[firstRowI]?.startsWith(
    linesOld[firstRowI],
  );

  let ansiStateNew: AnsiState = getFinalAnsiState(textOld);
  let ansiStateOld: AnsiState = { ...ansiStateNew };

  if (isLastLineStartsSame) {
    gotop++;
    rowI--;
  }

  for (; rowI >= 0; rowI--) {
    let lineOld = linesOld[rowI], lineNew = linesNew?.[rowI];

    if (rowI > 0 && (lineNew === undefined || lineNew.startsWith(lineOld))) {
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

    const isLastLineNewButOldIsBigger = linesNew.length < linesOld.length &&
      linesOld.length - (linesOld.length - linesNew.length) - rowI - 1 <= 0;
    if (isLastLineNewButOldIsBigger) {
      result += "\x1B[" + lineNew.length + "C" + "\x1B[J";
      isCursorSaved = false;
      break;
    }

    if (lineNew === undefined) {
      result += "\x1B[J";
      break;
    }

    if (!didGotop && !isLastLineStartsSame) {
      result += "\x1B[0G";
    }

    let goright = 0;
    const colLimit = Math.max(lineOld.length, lineNew.length);
    for (
      let colIOld = 0, colINew = 0;
      colIOld < colLimit;
      colIOld++, colINew++
    ) {
      const charOld = lineOld[colIOld];
      if (charOld === undefined) {
        if (goright > 0) {
          result += "\x1B[" + goright + "C";
        }
        goright = 0;
        result += lineNew.slice(colINew);
        break;
      }
      const ansiTokenNew = getAnsiToken(lineNew, colINew);
      if (ansiTokenNew) { // put new string ansi
        result += ansiTokenNew;
        colINew = colINew + ansiTokenNew.length - 1;
        colIOld--; // keep when continue
        getAnsiState(ansiStateNew, ansiTokenNew);
        continue;
      }
      const ansiTokenOld = getAnsiToken(lineOld, colIOld);
      if (ansiTokenOld) { // skip old string ansi
        colIOld = colIOld + ansiTokenOld.length - 1;
        colINew--; // keep when continue
        getAnsiState(ansiStateOld, ansiTokenOld);
        continue;
      }
      const charNew = lineNew?.[colINew];
      if (charNew === undefined) {
        if (goright > 0) {
          result += "\x1B[" + goright + "C";
        }
        result += linesNew.length < linesOld.length && rowI === firstRowI
          ? "\x1B[J"
          : "\x1B[0K";
        break;
      }
      if (
        charOld === charNew && ansiStateNew &&
        ansiStateCompare(ansiStateOld, ansiStateNew)
      ) {
        goright++;
        continue;
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
    result += linesNew[firstRowI].slice(linesOld[firstRowI].length);
  }
  result += linesNew.slice(linesOld.length).join("");

  return result;
}
