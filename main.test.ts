import { blue, green, magenta, red, yellow } from "@std/fmt/colors";
import { Logger } from "./main.ts";
import { assert, assertEquals } from "@std/assert";

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
  const originalWrite = Deno.stdout.write;
  Deno.stdout.write = (data: Uint8Array): Promise<number> => {
    output.push(new TextDecoder().decode(data));
    return Promise.resolve(data.byteLength);
  };

  try {
    logger.info("This is an informational message.");
    assertEquals(
      output[0],
      `${blue("ⓘ")} ${blue("[TestApp]")} This is an informational message.\n`,
    );
  } finally {
    Deno.stdout.write = originalWrite;
  }
});

Deno.test("Logger.warn logs warning messages", () => {
  const logger = new Logger("TestApp");
  const output: string[] = [];
  const originalWrite = Deno.stdout.write;
  Deno.stdout.write = (data: Uint8Array): Promise<number> => {
    output.push(new TextDecoder().decode(data));
    return Promise.resolve(data.byteLength);
  };

  try {
    logger.warn("This is a warning.");
    assertEquals(
      output[0],
      `${yellow("⚠")} ${yellow("[TestApp]")} This is a warning.\n`,
    );
  } finally {
    Deno.stdout.write = originalWrite;
  }
});

Deno.test("Logger.error logs error messages", () => {
  const logger = new Logger("TestApp");
  const output: string[] = [];
  const originalWrite = Deno.stdout.write;
  Deno.stdout.write = (data: Uint8Array): Promise<number> => {
    output.push(new TextDecoder().decode(data));
    return Promise.resolve(data.byteLength);
  };

  try {
    logger.error("This is an error.");
    assertEquals(
      output[0],
      `${red("✖")} ${red("[TestApp]")} This is an error.\n`,
    );
  } finally {
    Deno.stdout.write = originalWrite;
  }
});

Deno.test("Logger.success logs success messages", () => {
  const logger = new Logger("TestApp");
  const output: string[] = [];
  const originalWrite = Deno.stdout.write;
  Deno.stdout.write = (data: Uint8Array): Promise<number> => {
    output.push(new TextDecoder().decode(data));
    return Promise.resolve(data.byteLength);
  };

  try {
    logger.success("This is a success message.");
    assertEquals(
      output[0],
      `${green("✔")} ${green("[TestApp]")} This is a success message.\n`,
    );
  } finally {
    Deno.stdout.write = originalWrite;
  }
});

Deno.test("Logger.start and end log operations", () => {
  const logger = new Logger("TestApp");
  const output: string[] = [];
  const originalWrite = Deno.stdout.write;
  Deno.stdout.write = (data: Uint8Array): Promise<number> => {
    output.push(new TextDecoder().decode(data));
    return Promise.resolve(data.byteLength);
  };

  try {
    logger.start("Operating");
    logger.end(true);
    assert(logger.hasSucceeded);
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
    logger.end(false);
    assert(!logger.hasSucceeded);
    assertEquals(
      output[0],
      `${magenta("-")} ${magenta("[TestApp]")} Operating...`,
    );
    assertEquals(
      output[1],
      `\r${red("-")} ${red("[TestApp]")} Operating...${red("fail")}\n`,
    );

    output.length = 0;

    logger.start("Operating");
    logger.success("Succ");
    assert(logger.hasSucceeded);
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
    assert(logger.hasSucceeded);
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
    Deno.stdout.write = originalWrite;
  }
});

Deno.test("Logger.inline logs inline messages", () => {
  const logger = new Logger("TestApp");
  const output: string[] = [];
  const originalWrite = Deno.stdout.write;
  Deno.stdout.write = (data: Uint8Array): Promise<number> => {
    output.push(new TextDecoder().decode(data));
    return Promise.resolve(data.byteLength);
  };

  try {
    logger.inline("Starting machine...");
    logger.inline("done");
    assertEquals(output[0], `Starting machine...`);
    assertEquals(output[1], "done");
  } finally {
    Deno.stdout.write = originalWrite;
  }
});
