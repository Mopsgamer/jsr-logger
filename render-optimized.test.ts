import { assertEquals } from "@std/assert/equals";
import {
  countNewLines,
  optimizedUpdate,
  splitNewLines,
  type StreamSize,
} from "./render.ts";

const sizeNormal: StreamSize = { columns: 200, rows: 200 };
const sizeSmallWidth: StreamSize = { ...sizeNormal, columns: 2 };
const sizeSmallHeight: StreamSize = { ...sizeNormal, rows: 2 };
const sizeSmall: StreamSize = { ...sizeNormal, columns: 2, rows: 2 };

const textLong = `✓ @m234/logger Processing 1/3 ... done
⚠ @m234/logger Processing 2/3 ... aborted
✗ @m234/logger Processing 3/3 ... failed
| ✓ @m234/logger Sub-task ... done
|   | ✓ @m234/logger Sub-sub-task log text aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ... done
✓ @m234/logger Thinking ... skipped`;

Deno.test("newLineCount", () => {
  assertEquals(countNewLines("", { columns: 120, rows: 200 }), 0);
  assertEquals(countNewLines("\n", { columns: 120, rows: 200 }), 1);
  assertEquals(countNewLines(textLong, { columns: 90, rows: 200 }), 6);
  assertEquals(countNewLines(textLong, { columns: 110, rows: 200 }), 5);
  assertEquals(countNewLines(textLong, { columns: 50, rows: 200 }), 6);
});

Deno.test("splitNewLines", () => {
  assertEquals(
    countNewLines("", { columns: 120, rows: 200 }),
    splitNewLines("", { columns: 120, rows: 200 }).length - 1,
  );
  assertEquals(
    countNewLines("\n", { columns: 120, rows: 200 }),
    splitNewLines("\n", { columns: 120, rows: 200 }).length - 1,
  );
  assertEquals(
    countNewLines(textLong, { columns: 90, rows: 200 }),
    splitNewLines(textLong, { columns: 90, rows: 200 }).length - 1,
  );
  assertEquals(
    countNewLines(textLong, { columns: 110, rows: 200 }),
    splitNewLines(textLong, { columns: 110, rows: 200 }).length - 1,
  );
  assertEquals(
    countNewLines(textLong, { columns: 50, rows: 200 }),
    splitNewLines(textLong, { columns: 50, rows: 200 }).length - 1,
  );
  assertEquals(
    splitNewLines("hello\nworld", { columns: 2, rows: 200 }),
    ["he", "ll", "o\n", "wo", "rl", "d"],
  );
});

Deno.test("no diff", () => {
  assertEquals(
    optimizedUpdate("hello", "hello", sizeNormal),
    "",
  );
});
Deno.test("first time print", () => {
  assertEquals(
    optimizedUpdate("", "hello\nworld", sizeNormal),
    "hello\nworld",
  );
});
Deno.test("add new line", () => {
  assertEquals(
    optimizedUpdate("hello", "hello\nworld", sizeNormal),
    "\nworld",
  );
});
Deno.test("add new line small screen", () => {
  assertEquals(
    optimizedUpdate("hello", "hello\nworld", sizeSmallWidth),
    "\nworld",
  );
});

Deno.test("remove rest", () => {
  assertEquals(
    optimizedUpdate("hello\nworld", "hello", sizeNormal),
    "\x1B[1F\x1B[5C\x1B[J",
  );
});
Deno.test("remove rest small screen", () => {
  assertEquals(
    optimizedUpdate("hello\nworld", "hello", sizeSmallWidth),
    "\x1B[3F\x1B[1C\x1B[J",
  );
});
Deno.test("partial update", () => {
  assertEquals(
    optimizedUpdate("hello", "xello\nworld", sizeNormal),
    "\x1B[0Gx\x1B[4C\nworld",
    // \x1b[0Gx\nworld
  );
});
Deno.test("partial update small screen", () => {
  assertEquals(
    optimizedUpdate("hello", "xello\nworld", sizeSmallWidth),
    "\x1B[s\x1B[2Fx\x1B[u\nworld",
  );
});
