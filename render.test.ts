import { assert, assertEquals, assertFalse } from "jsr:@std/assert";
import { Logger, Task } from "./main.ts";
import { isPending, mutex, render, renderer, taskList } from "./render.ts";
import { bold, magenta, red } from "@std/fmt/colors";
import { patchOutput } from "./output-patcher.ts";
import { assertArrayIncludes } from "jsr:@std/assert/array-includes";

declare global {
  var __FORCE_RENDER__: boolean | undefined;
  var __DISABLE_RENDERER_LOOP__: boolean | undefined;
  var __RENDERER_TIMEOUT__: number | undefined;
}

globalThis.__RENDERER_TIMEOUT__ = 100;

const loggerTestApp = new Logger({ prefix: "TestApp" });
const logger_ = new Logger({ prefix: "" });

Deno.test("render", async () => {
  const { output, outputUnpatch } = patchOutput();
  taskList.length = 0;

  render();

  new Task({ logger: loggerTestApp, text: "Operating" });
  const task1 = new Task({ logger: loggerTestApp, text: "Operating" }).start();
  const task2 = new Task({ logger: loggerTestApp, text: "Operating" }).start().end("failed");

  render();
  const joined = output.join("");
  assert(joined.includes("Operating ..."));

  task1.end("completed");
  await mutex.acquire();
  mutex.release();
  outputUnpatch();
});

Deno.test("renderer", async () => {
  const { output, outputUnpatch } = patchOutput();
  taskList.length = 0;

  const keeper = new Task({ logger: loggerTestApp, text: "Operating" }).start();
  const task2 = new Task({ logger: loggerTestApp, text: "Operating" }).start().end("failed");

  keeper.end("completed");
  await mutex.acquire();
  mutex.release();

  const joined = output.join("");
  assert(joined.includes("Operating ..."));

  output.length = 0;
  taskList.length = 0;

  const keeper2 = new Task({ logger: loggerTestApp, text: "Operating" }).start();
  keeper2.end("completed");
  await mutex.acquire();
  mutex.release();

  assert(output.join("").includes("Operating ..."));

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
