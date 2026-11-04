import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const project = fileURLToPath(new URL("../", import.meta.url));
const canonical = [path.join(project, "docs/fixtures/sample-payload.json"), path.resolve(project, "../docs/fixtures/sample-payload.json")].find(file => fs.existsSync(file));
if (!canonical) throw new Error("The canonical docs/fixtures/sample-payload.json is missing.");
const frontend = path.join(project, "src/lib/contract/sample-payload.json");
const original = fs.readFileSync(canonical, "utf8");
const parsed = JSON.parse(original);
if (process.argv.includes("--write")) {
  fs.writeFileSync(frontend, original);
  console.log("Synchronized the frontend test fixture from the canonical docs fixture.");
} else {
  if (!isDeepStrictEqual(parsed, JSON.parse(fs.readFileSync(frontend, "utf8")))) throw new Error("Contract fixture drift: review canonical changes, then run the sync command. Do not hand-edit the derived frontend fixture.");
  console.log("Canonical and frontend contract fixtures are semantically identical (formatting ignored).");
}
