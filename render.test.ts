import { assertEquals } from "@std/assert/equals";
import { Task } from "./main.ts";
import { list, mutex, render, renderCI, renderer, state } from "./render.ts";
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
