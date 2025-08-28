import { assertEquals } from "jsr:@std/assert/equals";
import { Task } from "./main.ts";
import { render, renderCI, renderer, state } from "./render.ts";
import { bold, magenta, red } from "@std/fmt/colors";

state.noLoop = true;

Deno.test("renderer", async () => {
  new Task({ prefix: "[TestApp]", text: "Operating" });
  new Task({ prefix: "[TestApp]", text: "Operating" }).start();
  new Task({ prefix: "[TestApp]", text: "Operating" }).start().end("failed");
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = (data: string): boolean => {
    output.push(data);
    return true;
  };
  render();
  assertEquals(output, [
    "",
    magenta("- [TestApp]") + " Operating ...\n" +
    red("✗ [TestApp]") + " Operating ... " + bold(red("failed")) + "\n",
  ]);
  process.stdout.write = originalWrite;
});

Deno.test("renderCI", () => {
  renderCI();
});

Deno.test("renderer", async () => {
  renderer(true);
  new Task({ prefix: "[TestApp]", text: "Operating" });
  new Task({ prefix: "[TestApp]", text: "Operating" }).start();
  new Task({ prefix: "[TestApp]", text: "Operating" }).start().end("failed");
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = (data: string): boolean => {
    output.push(data);
    return true;
  };
  await Task.mutex.acquire();
  assertEquals(output, [
    "\x1b[?25l",
    magenta("- [TestApp]") + " Operating ...\n",
    red("✗ [TestApp]") + " Operating ... " + bold(red("failed")) + "\n",
    "\x1b[?25h",
  ]);
  process.stdout.write = originalWrite;
  Task.mutex.release();
});
