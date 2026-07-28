#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { analyzeProject } from "./analyzer.js";
import { writeReports } from "./report.js";

function parseArgs(argv) {
  const args = {
    target: process.cwd(),
    out: "docs/api-scenarios",
  };

  const rest = [...argv];
  while (rest.length > 0) {
    const token = rest.shift();
    if (token === "--out") {
      args.out = rest.shift() ?? args.out;
    } else if (token === "--help" || token === "-h") {
      args.help = true;
    } else if (!token.startsWith("--")) {
      args.target = token;
    }
  }

  return args;
}

function printHelp() {
  console.log(`Frontend API Scenario Analyzer

Usage:
  node src/cli.js <project-path> --out <output-dir>

Examples:
  npm run analyze -- ../my-next-app --out docs/api-scenarios
  npx api-scenario-analyzer . --out api-scenarios
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const targetRoot = path.resolve(args.target);
  const outDir = path.resolve(process.cwd(), args.out);

  const result = await analyzeProject(targetRoot);
  await writeReports(result, outDir);

  console.log(`Analyzed: ${targetRoot}`);
  console.log(`Routes: ${result.routes.length}`);
  console.log(`Files with API activity: ${result.components.length}`);
  console.log(`Output: ${outDir}`);
}

main().catch((error) => {
  console.error(error?.stack ?? String(error));
  process.exitCode = 1;
});
