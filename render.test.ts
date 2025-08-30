import { assertEquals } from "jsr:@std/assert/equals";
import { Task } from "./main.ts";
import {
  list,
  mutex,
  newLineCount,
  render,
  renderCI,
  renderer,
  state,
} from "./render.ts";
import { bold, magenta, red } from "@std/fmt/colors";
import { patchOutput } from "./output-patcher.test.ts";

state.noLoop = true;

Deno.test("render", async () => {
  const { output, outputUnpatch } = patchOutput();
  render();
  assertEquals(output, []);
  new Task({ prefix: "TestApp", text: "Operating" });
  new Task({ prefix: "TestApp", text: "Operating" }).start();
  new Task({ prefix: "TestApp", text: "Operating" }).start().end("failed");
  render();
  assertEquals(output, [
    "",
    magenta("- TestApp") + " Operating ...\n" +
    red("✗ TestApp") + " Operating ... " + bold(red("failed")) + "\n",
  ]);
  outputUnpatch();
});

Deno.test("renderCI", async () => {
  const { output, outputUnpatch } = patchOutput();
  list.length = 0;
  assertEquals(await renderCI(), true);
  const task = new Task({ prefix: "TestApp", text: "Operating" });
  assertEquals(await renderCI(), false);
  task.start();
  assertEquals(await renderCI(), false);
  task.end("completed");
  assertEquals(await renderCI(), true);
  outputUnpatch();
});

Deno.test("renderer", async () => {
  const { output, outputUnpatch } = patchOutput();
  renderer(true);
  new Task({ prefix: "TestApp", text: "Operating" });
  new Task({ prefix: "TestApp", text: "Operating" }).start();
  new Task({ prefix: "TestApp", text: "Operating" }).start().end("failed");
  await mutex.acquire();
  assertEquals(output, [
    "\x1b[?25l",
    magenta("- TestApp") + " Operating ...\n",
    red("✗ TestApp") + " Operating ... " + bold(red("failed")) + "\n",
    "\x1b[?25h",
  ]);
  mutex.release();
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
