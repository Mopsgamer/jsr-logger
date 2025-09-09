import { assertEquals } from "@std/assert/equals";
import {
  optimizedUpdate,
  splitNewLines,
  streamSize,
} from "./render-optimized.ts";
import { gray, green, red, yellow } from "@std/fmt/colors";

const sizeNormal = streamSize(200, 200);
const sizeSmallWidth = streamSize(2, 200);
const sizeSmallHeight = streamSize(200, 2);
const sizeSmall = streamSize(2, 2);

Deno.test("splitNewLines", () => {
  assertEquals(
    splitNewLines("", streamSize(120, 200)).length,
    0,
  );
  assertEquals(
    splitNewLines("\n", streamSize(120, 200)).length,
    1,
  );
  const textList = [
    `✓ @m234/logger Processing 1/3 ... done
⚠ @m234/logger Processing 2/3 ... aborted
✗ @m234/logger Processing 3/3 ... failed
| ✓ @m234/logger Sub-task ... done
|   | ✓ @m234/logger Sub-sub-task log text aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ... done
✓ @m234/logger Thinking ... skipped`,
    `${green("✓ @m234/logger")} Processing 1/3 ... ${green("done")}
${yellow("⚠ @m234/logger")} Processing 2/3 ... ${yellow("aborted")}
${red("✗ @m234/logger")} Processing 3/3 ... ${red("failed")}
${green("✓ @m234/logger")} Sub-task ... ${green("done")}
|   ${
      green("✓ @m234/logger")
    } Sub-sub-task log text aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ... ${
      green("done")
    }
${gray("✓ @m234/logger")} Thinking ... ${gray("skipped")}`,
  ];
  for (const text of textList) {
    assertEquals(
      splitNewLines(text, streamSize(90, 200)).length - 1,
      6,
    );
    assertEquals(
      splitNewLines(text, streamSize(110, 200)).length - 1,
      5,
    );
    assertEquals(
      splitNewLines(text, streamSize(50, 200)).length - 1,
      6,
    );
  }
  assertEquals(
    splitNewLines("hello\nworld", streamSize(2, 200)),
    ["he", "ll", "o\n", "wo", "rl", "d"],
  );
  assertEquals(
    splitNewLines("\x1B[0Ghello", sizeNormal),
    ["\x1B[0Ghello"],
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
Deno.test("update current line and append", () => {
  assertEquals(
    optimizedUpdate("hello", "xello\nworld", sizeNormal),
    "\x1B[0Gx\x1B[4C\nworld",
  );
});
Deno.test("update previous line", () => {
  assertEquals(
    optimizedUpdate("hello\nworld", "xello\nworld", sizeNormal),
    "\x1B[s\x1B[1Fx\x1B[u",
  );
});
Deno.test("append previous line only", () => {
  assertEquals(
    optimizedUpdate("hello\nworld\n!", "hello\nworld x\n!", sizeNormal),
    "\x1B[s\x1B[1F\x1B[5C x\n\x1B[u!",
  );
});
Deno.test("update current line small screen", () => {
  assertEquals(
    optimizedUpdate("hello", "xello\nworld", sizeSmallWidth),
    "\x1B[s\x1B[2Fx\x1B[u\nworld",
  );
});
Deno.test("update color", () => {
  assertEquals(
    optimizedUpdate(
      "\x1B[0;93mhello\x1B[0m",
      "\x1B[0;92mxello\x1B[0m",
      sizeNormal,
    ),
    "\x1B[0G\x1B[0;92mxello\x1B[0m",
  );
});
