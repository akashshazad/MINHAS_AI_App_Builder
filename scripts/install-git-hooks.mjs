
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

if (!existsSync(".git")) {
  console.log("[hooks] .git not present; CI/source archive does not install local hooks.");
  process.exit(0);
}
execFileSync("git", ["config", "core.hooksPath", ".husky"], { stdio: "inherit" });
console.log("[hooks] Git core.hooksPath=.husky");


