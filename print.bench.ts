import { Logger } from "@m234/logger";
import process from "node:process";

process.stdout.write = function (str: string | Uint8Array): boolean {
  return true;
};

Deno.bench({
  name: "print",
  group: "print",
  fn(b) {
    using logger = new Logger("MyApp");
    b.start();
    logger.print("hello");
    b.end();
  },
});

Deno.bench({
  name: "println",
  group: "print",
  fn(b) {
    using logger = new Logger("MyApp");
    b.start();
    logger.println("hello");
    b.end();
  },
});

Deno.bench({
  name: "printf",
  group: "print",
  fn(b) {
    using logger = new Logger("MyApp");
    b.start();
    logger.printf("hello");
    b.end();
  },
});

Deno.bench({
  name: "printfln",
  group: "print",
  fn(b) {
    using logger = new Logger("MyApp");
    b.start();
    logger.printfln("hello");
    b.end();
  },
});
