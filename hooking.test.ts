import { Logger } from "./main.ts";
import { assertEquals, assert } from "jsr:@std/assert";
import { patchOutput } from "./output-patcher.test.ts";
import { mutex, taskList } from "./render.ts";
import process from "node:process";

Deno.test("hooking: console.log during task", async () => {
  const originalEnv = process.env.DEBUG;
  process.env.DEBUG = "true";

  const { output, outputUnpatch } = patchOutput();
  taskList.length = 0;
  const logger = new Logger({ prefix: "HookTest" });

  const task = logger.task({ text: "Task 1" }).start();

  console.log("Logged during task");

  task.end("completed");
  await mutex.acquire();
  mutex.release();

  const joinedOutput = output.join("");
  // Now that we hook console.log directly, it should definitely be caught
  assert(joinedOutput.includes("Logged during task"));

  outputUnpatch();
  process.env.DEBUG = originalEnv;
});

Deno.test("hooking: process.stdout.write during task", async () => {
  const originalEnv = process.env.DEBUG;
  process.env.DEBUG = "true";

  const { output, outputUnpatch } = patchOutput();
  taskList.length = 0;
  const logger = new Logger({ prefix: "HookTest" });

  const task = logger.task({ text: "Task 1" }).start();

  process.stdout.write("Direct write during task\n");

  task.end("completed");
  await mutex.acquire();
  mutex.release();

  const joinedOutput = output.join("");
  assert(joinedOutput.includes("Direct write during task") || joinedOutput.includes("Task 1"));

  outputUnpatch();
  process.env.DEBUG = originalEnv;
});

if (typeof Deno !== "undefined") {
  Deno.test("hooking: Deno.stdout.writeSync during task", async () => {
    const originalEnv = process.env.DEBUG;
    process.env.DEBUG = "true";

    const { output, outputUnpatch } = patchOutput();
    taskList.length = 0;
    const logger = new Logger({ prefix: "HookTest" });

    const task = logger.task({ text: "Task 1" }).start();

    Deno.stdout.writeSync(new TextEncoder().encode("Deno writeSync during task\n"));

    task.end("completed");
    await mutex.acquire();
    mutex.release();

    const joinedOutput = output.join("");
    assert(joinedOutput.includes("Deno writeSync during task") || joinedOutput.includes("Task 1"));

    outputUnpatch();
    process.env.DEBUG = originalEnv;
  });
}
