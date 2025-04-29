import { makeBadge } from "badge-maker";
import { stripAnsiCode } from "@std/fmt/colors";
import { existsSync } from "node:fs";

await new Deno.Command("deno", {
  args: ["test", "--coverage", "--clean", "-q"],
  stdout: "null",
})
  .output();

const outputCov = new TextDecoder().decode(
  (await new Deno.Command("deno", { args: ["coverage", "-q"] })
    .output())
    .stdout,
);

const percentCov = parseFloat(
  stripAnsiCode(
    outputCov.split("\n")
      .find((line) => line.includes("All files"))!
      .split("|").at(-2)!,
  ).trim(),
);

const outputTest = new TextDecoder().decode(
  (await new Deno.Command("deno", { args: ["test"] }).output())
    .stdout,
);

const summary = outputTest.split("\n")
  .find((line) => line.includes("passed") && line.includes("failed"))!
  .split("|").map((s) => stripAnsiCode(s).trim());

const passed = parseInt(summary.find((col) => col.includes("passed")) ?? "0");
const failed = parseInt(summary.find((col) => col.includes("failed")) ?? "0");
// const ignored = parseInt(summary.find((col) => col.includes("ignored")) ?? "0");
const percentPass = passed / ((passed + failed) || passed) * 100;

if (!existsSync("assets")) Deno.mkdirSync("assets");

/**
 * 100 - green
 *
 * 50 - yellow
 *
 * 0 - red
 */
function colorFromPercent(percent: number): string {
  const max = 220;
  const r = percent < 50
    ? max
    : Math.floor(max - (percent * 2 - 100) * max / 100);
  const g = percent > 50 ? max : Math.floor((percent * 2) * max / 100);
  return "rgb(" + r + "," + g + ",0)";
}

Deno.writeTextFile(
  "assets/badge-tests.svg",
  makeBadge({
    color: colorFromPercent(percentPass),
    message: `${percentPass.toFixed(1)}% - ${passed} passed, ${failed} failed`,
    label: "tests",
  }),
);

Deno.writeTextFile(
  "assets/badge-cov.svg",
  makeBadge({
    color: colorFromPercent(percentCov),
    message: `${percentCov}%`,
    label: "coverage",
  }),
);
