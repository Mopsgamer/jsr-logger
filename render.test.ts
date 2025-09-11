import { assertEquals } from "@std/assert/equals";
import { Task } from "./main.ts";
import { render, renderer, state } from "./render.ts";
import { bold, magenta, red } from "@std/fmt/colors";
import { patchOutput } from "./output-patcher.test.ts";
import { assertArrayIncludes } from "jsr:@std/assert/array-includes";

state.noLoop = true;

Deno.test("render", async () => {
  const { output, outputUnpatch } = patchOutput();
  render();
  assertEquals(output, []);
  output.length = 0;
  new Task({ prefix: "TestApp", text: "Operating" });
  new Task({ prefix: "TestApp", text: "Operating" }).start();
  new Task({ prefix: "TestApp", text: "Operating" }).start().end("failed");
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
  new Task({ prefix: "TestApp", text: "Operating" });
  const keeper = new Task({ prefix: "TestApp", text: "Operating" }).start();
  new Task({ prefix: "TestApp", text: "Operating" }).start().end("failed");
  await completed;
  assertArrayIncludes(output, [
    magenta("- TestApp") + " Operating ...\n",
    red("✗ TestApp") + " Operating ... " + bold(red("failed")) + "\n",
  ]);
  keeper.end("completed");
  output.length = 0;
  renderer();
  new Task({ prefix: "TestApp", text: "Operating" });
  new Task({ prefix: "TestApp", text: "Operating" }).start();
  new Task({ prefix: "TestApp", text: "Operating" }).start().end("failed");
  assertArrayIncludes(output, [
    magenta("- TestApp") + " Operating ...\n",
    red("✗ TestApp") + " Operating ... " + bold(red("failed")) + "\n",
  ]);
  outputUnpatch();
});
