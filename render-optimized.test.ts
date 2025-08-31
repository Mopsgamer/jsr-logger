import { assertEquals } from "@std/assert/equals";
import { optimizedUpdate, splitNewLines, streamSize } from "./render.ts";

const sizeNormal = streamSize(200, 200);
const sizeSmallWidth = streamSize(2, 200);
const sizeSmallHeight = streamSize(200, 2);
const sizeSmall = streamSize(2, 2);

Deno.test("splitNewLines", () => {
  assertEquals(
    splitNewLines("", streamSize(120, 200)).length - 1,
    0,
  );
  assertEquals(
    splitNewLines("\n", streamSize(120, 200)).length - 1,
    1,
  );
  const textLong = `✓ @m234/logger Processing 1/3 ... done
⚠ @m234/logger Processing 2/3 ... aborted
✗ @m234/logger Processing 3/3 ... failed
| ✓ @m234/logger Sub-task ... done
|   | ✓ @m234/logger Sub-sub-task log text aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ... done
✓ @m234/logger Thinking ... skipped`;
  assertEquals(
    splitNewLines(textLong, streamSize(90, 200)).length - 1,
    6,
  );
  assertEquals(
    splitNewLines(textLong, streamSize(110, 200)).length - 1,
    5,
  );
  assertEquals(
    splitNewLines(textLong, streamSize(50, 200)).length - 1,
    6,
  );
  assertEquals(
    splitNewLines("hello\nworld", streamSize(2, 200)),
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
  );
});
Deno.test("partial update small screen", () => {
  assertEquals(
    optimizedUpdate("hello", "xello\nworld", sizeSmallWidth),
    "\x1B[s\x1B[2Fx\x1B[u\nworld",
  );
});
