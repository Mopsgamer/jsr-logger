import ansiRegex from "ansi-regex";

export type StreamSize = { columns: number; rows: number };

export function streamSize(columns: number, rows: number): StreamSize {
  return { columns, rows };
}

function getAnsiToken(text: string, charI: number): string | undefined {
  const sub = text.substring(charI);
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
  let shouldSaveCursor = false;

  const linesOldLastI = linesOld.length - 1;

  for (let rowI = linesOldLastI; rowI >= 0; rowI--) {
    let lineOld = linesOld[rowI], lineNew = linesNew?.[rowI];

    if (rowI > 0) {
      for (let nextRowI = rowI; nextRowI >= 0; nextRowI--) {
        lineOld = linesOld[nextRowI], lineNew = linesNew?.[nextRowI];
        if (
          nextRowI > 0 && lineNew === undefined ||
          (nextRowI === linesOldLastI && lineNew.startsWith(lineOld)) ||
          lineOld === lineNew
        ) {
          gotop++;
          continue;
        }
        rowI = nextRowI;
        break;
      }
      if (gotop > 0) {
        shouldSaveCursor = true;
        result += "\x1B[" + gotop + "F";
      }
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
      shouldSaveCursor = false;
      break;
    }

    if (lineNew === undefined) {
      result += "\x1B[J";
      break;
    }

    if (
      gotop === 0 &&
      !(lineOld === lineNew ||
        (rowI === linesOldLastI && lineNew.startsWith(lineOld)))
    ) {
      result += "\x1B[0G";
    }

    let goright = 0;
    let colorStateOld, colorStateNew = colorStateOld = "\x1B[39m";
    for (
      let colIOld = 0, colINew = 0;
      colIOld < lineOld.length;
      colIOld++, colINew++
    ) {
      const ansiTokenNew = getAnsiToken(lineNew, colINew);
      if (ansiTokenNew) { // put new string ansi
        result += ansiTokenNew;
        colINew = colINew + ansiTokenNew.length - 1;
        colIOld--; // keep when continue
        colorStateNew = ansiTokenNew;
        continue;
      }
      const ansiTokenOld = getAnsiToken(lineOld, colIOld);
      if (ansiTokenOld) { // skip old string ansi
        colIOld = colIOld + ansiTokenOld.length - 1;
        colINew--; // keep when continue
        colorStateOld = ansiTokenOld;
        continue;
      }
      const charOld = lineOld[colIOld], charNew = lineNew?.[colINew];
      if (charNew === undefined) {
        result += isLastLineNewButOldIsBigger ? "\x1B[J" : "\x1B[0K";

        break;
      }
      if (charOld === charNew && colorStateOld === colorStateNew) {
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

  if (shouldSaveCursor) {
    result = "\x1B[s" + result + "\x1B[u";
  }
  if (textNew.length > textOld.length) {
    result += textNew.substring(textOld.length);
  }

  return result;
}
