import { assert, assertEquals, assertFalse } from "jsr:@std/assert";
import { Logger, Task } from "./main.ts";
import {
  isPending,
  newLineCount,
  render,
  renderer,
  state,
  taskList,
} from "./render.ts";
import { bold, magenta, red } from "@std/fmt/colors";
import { patchOutput } from "./output-patcher.test.ts";
import { assertArrayIncludes } from "jsr:@std/assert/array-includes";

state.noLoop = true;

const loggerTestApp = new Logger({ prefix: "TestApp" });
const logger_ = new Logger({ prefix: "" });

Deno.test("render", async () => {
  const { output, outputUnpatch } = patchOutput();
  render();
  assertEquals(output, []);
  new Task({ logger: loggerTestApp, text: "Operating" });
  new Task({ logger: loggerTestApp, text: "Operating" }).start();
  new Task({ logger: loggerTestApp, text: "Operating" }).start().end("failed");
  render();
  assertEquals(
    output.at(-1),
    magenta("- TestApp") + " Operating ...\n" +
      red("✗ TestApp") + " Operating ... " + bold(red("failed")) + "\n",
  );
  outputUnpatch();
});

Deno.test("renderer", async () => {
  const { output, outputUnpatch } = patchOutput();
  const completed = renderer(true);
  new Task({ logger: loggerTestApp, text: "Operating" });
  const keeper = new Task({ logger: loggerTestApp, text: "Operating" }).start();
  new Task({ logger: loggerTestApp, text: "Operating" }).start().end("failed");
  await completed;
  assertArrayIncludes(output, [
    magenta("- TestApp") + " Operating ...\n",
    red("✗ TestApp") + " Operating ... " + bold(red("failed")) + "\n",
  ]);
  keeper.end("completed");
  output.length = 0;
  renderer();
  new Task({ logger: loggerTestApp, text: "Operating" });
  new Task({ logger: loggerTestApp, text: "Operating" }).start();
  new Task({ logger: loggerTestApp, text: "Operating" }).start().end("failed");
  assertArrayIncludes(output, [
    magenta("- TestApp") + " Operating ...\n",
    red("✗ TestApp") + " Operating ... " + bold(red("failed")) + "\n",
  ]);
  outputUnpatch();
});

Deno.test("newLineCount", () => {
  const textLong = `✓ @m234/logger Processing 1/3 ... done
⚠ @m234/logger Processing 2/3 ... aborted
✗ @m234/logger Processing 3/3 ... failed
  | ✓ @m234/logger Sub-task ... done
  |   | ✓ @m234/logger Sub-sub-task log text aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ... done
✓ @m234/logger Thinking ... skipped`;
  assertEquals(newLineCount("", 120), 0);
  assertEquals(newLineCount("\n", 120), 1);
  assertEquals(newLineCount(textLong, 90), 6);
  assertEquals(newLineCount(textLong, 110), 5);
  assertEquals(newLineCount(textLong, 50), 6);
});

Deno.test("isPending", () => {
  taskList.length = 0;
  assertFalse(isPending());

  new Task({ state: "idle", text: "", logger: logger_ });
  assertFalse(isPending());

  taskList.length = 0;
  new Task({ state: "idle", text: "", logger: logger_ });
  new Task({ state: "started", text: "", logger: logger_ });
  assert(isPending());

  taskList.length = 0;
  new Task({ state: "idle", text: "", logger: logger_ });
  new Task({ state: "failed", text: "", logger: logger_ });
  assertFalse(isPending());
});
