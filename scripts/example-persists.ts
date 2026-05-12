import { Logger } from "../main.ts";

const logger = new Logger({
  prefix: "@m234/logger",
  defaultTaskOptions: { suffixDuration: true },
});

let task1 = logger.task({ text: "How the console.log persists?" })
  .start();
setTimeout(() => task1.end("completed"), 3000);
setTimeout(() => console.log("console.log 500"), 500);
setTimeout(() => console.log("console.log 1000"), 1000);
setTimeout(() => process.stdout.write("process.stdout.write 1050"), 1050);
setTimeout(() => task1.logger.info("task.logger.info 1200"), 1200);
setTimeout(() => console.log("console.log 1500"), 1500);
