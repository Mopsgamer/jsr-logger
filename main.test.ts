import { blue, green, magenta, red, yellow } from "@std/fmt/colors";
import { Logger } from "./main.ts";
import { assertEquals } from "@std/assert";
import process from "node:process";

Deno.test("Logger.format logs args right", () => {
  const logger = new Logger("TestApp");

  assertEquals(logger.format("a.b."), `a.b.`);
  assertEquals(logger.format(true), `true`);
  assertEquals(logger.format({}), `[object Object]`);
  assertEquals(logger.format([]), ``);
});

Deno.test("Logger.info logs informational messages", () => {
  const logger = new Logger("TestApp");
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = (data: string): boolean => {
    output.push(data);
    return true;
  };

  try {
    logger.info("This is an informational message.");
    assertEquals(
      output[0],
      `${blue("ⓘ")} ${blue("[TestApp]")} This is an informational message.\n`,
    );
  } finally {
    process.stdout.write = originalWrite;
  }
});

Deno.test("Logger.warn logs warning messages", () => {
  const logger = new Logger("TestApp");
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = (data: string): boolean => {
    output.push(data);
    return true;
  };

  try {
    logger.warn("This is a warning.");
    assertEquals(
      output[0],
      `${yellow("⚠")} ${yellow("[TestApp]")} This is a warning.\n`,
    );
  } finally {
    process.stdout.write = originalWrite;
  }
});

Deno.test("Logger.error logs error messages", () => {
  const logger = new Logger("TestApp");
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = (data: string): boolean => {
    output.push(data);
    return true;
  };

  try {
    logger.error("This is an error.");
    assertEquals(
      output[0],
      `${red("✖")} ${red("[TestApp]")} This is an error.\n`,
    );
  } finally {
    process.stdout.write = originalWrite;
  }
});

Deno.test("Logger.success logs success messages", () => {
  const logger = new Logger("TestApp");
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = (data: string): boolean => {
    output.push(data);
    return true;
  };

  try {
    logger.success("This is a success message.");
    assertEquals(
      output[0],
      `${green("✔")} ${green("[TestApp]")} This is a success message.\n`,
    );
  } finally {
    process.stdout.write = originalWrite;
  }
});

Deno.test("Logger.start and end continuous log", () => {
  const logger = new Logger("TestApp");
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = (data: string): boolean => {
    output.push(data);
    return true;
  };

  try {
    logger.start("Operating");
    logger.end("completed");
    assertEquals(logger.state, "completed");
    assertEquals(
      output[0],
      `${magenta("-")} ${magenta("[TestApp]")} Operating...`,
    );
    assertEquals(
      output[1],
      `\r${green("-")} ${green("[TestApp]")} Operating...${green("done")}\n`,
    );
    output.length = 0;

    logger.start("Operating");
    logger.end("failed");
    assertEquals(logger.state, "failed");
    assertEquals(
      output[0],
      `${magenta("-")} ${magenta("[TestApp]")} Operating...`,
    );
    assertEquals(
      output[1],
      `\r${red("-")} ${red("[TestApp]")} Operating...${red("failed")}\n`,
    );

    output.length = 0;

    logger.start("Operating");
    logger.success("Succ");
    assertEquals(logger.state, "completed");
    assertEquals(
      output[0],
      `${magenta("-")} ${magenta("[TestApp]")} Operating...`,
    );
    assertEquals(
      output[1],
      `\r${green("-")} ${green("[TestApp]")} Operating...${green("done")}\n`,
    );
    assertEquals(output[2], `${green("✔")} ${green("[TestApp]")} Succ\n`);

    output.length = 0;

    logger.start("Operating");
    logger.info("test");
    assertEquals(logger.state, "completed");
    assertEquals(
      output[0],
      `${magenta("-")} ${magenta("[TestApp]")} Operating...`,
    );
    assertEquals(
      output[1],
      `\r${green("-")} ${green("[TestApp]")} Operating...${green("done")}\n`,
    );
    assertEquals(output[2], `${blue("ⓘ")} ${blue("[TestApp]")} test\n`);
  } finally {
    process.stdout.write = originalWrite;
  }
});
