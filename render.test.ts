import { assert, assertEquals, assertFalse } from "jsr:@std/assert";
import { Logger, Task } from "./main.ts";
import { isPending, render, renderer, taskList } from "./render.ts";
import { bold, magenta, red } from "@std/fmt/colors";
import { patchOutput } from "./output-patcher.test.ts";
import { assertArrayIncludes } from "jsr:@std/assert/array-includes";

const loggerTestApp = new Logger({ prefix: "TestApp" });
const logger_ = new Logger({ prefix: "" });

const makeVisible = (str: string) => {
  if (typeof str !== "string") return str;
  return str.replace(/[\x00-\x1F\x7F]/g, (match) => {
    const hex = match.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0");
    return `_0x${hex}_`;
  });
};

Deno.test("render", async () => {
  const { output, outputUnpatch } = patchOutput();
  render();
  assertEquals(output, ["\n"]);
  new Task({ logger: loggerTestApp, text: "Operating" });
  new Task({ logger: loggerTestApp, text: "Operating" }).start();
  new Task({ logger: loggerTestApp, text: "Operating" }).start().end("failed");
  render();
  assertEquals(
    makeVisible(output.at(-1)!),
    makeVisible(
      magenta("- TestApp") + " Operating ...\n" +
        red("✗ TestApp") + " Operating ... " + bold(red("failed")) + "\n",
    ),
  );
  outputUnpatch();
});

Deno.test("renderer", async () => {
  const { output, outputUnpatch } = patchOutput();
  const completed = renderer();
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
