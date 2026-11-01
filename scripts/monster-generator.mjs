#!/usr/bin/env node
// Regenerates the monster Actors of the SW25 library packs from the live wiki
// using the vendored sword-world-25 parser (scripts/lib/monster-parser.mjs).
//
// Usage:
//   node scripts/monster-generator.mjs --ids <ids.txt> [--dry-run] [--report <path.json>] [--report-md <path.md>]
//   node scripts/monster-generator.mjs --all [--dry-run] [--report <path.json>] [--report-md <path.md>]
//
// Each ids.txt line is an Actor `_id` (one per line). With --all every Actor of the
// eleven monster packs is processed. Actor `_id`s, names, tokens and folders are
// preserved; only `system` is replaced by freshly parsed wiki data.

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { parseMonsterPage } from "./lib/monster-parser.mjs";
import { fetchMonsterPage, RateLimiter } from "./lib/fetch-wiki.mjs";

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const packsDir = path.join(root, "packs");
const PACKS = ["monsters-animals","monsters-barbarous","monsters-constructs","monsters-daemons","monsters-fairies","monsters-golems","monsters-humanoids","monsters-magitech","monsters-mythical-beasts","monsters-plants","monsters-undead"];

const args = process.argv.slice(2);
const argValue = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const has = name => args.includes(name);
const DRY_RUN = has("--dry-run");
const ALL = has("--all");
const idsFile = argValue("--ids");
const reportPath = argValue("--report");
const reportMdPath = argValue("--report-md");

const readPack = pack => fs.readFileSync(path.join(packsDir, `${pack}.db`), "utf8").split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const writeAtomic = (file, text) => {
  const tmp = file + ".regen.tmp";
  fs.writeFileSync(tmp, text, "utf8");
  fs.renameSync(tmp, file);
};
const slugOf = sourceUrl => { try { return decodeURIComponent(new URL(sourceUrl).pathname.split(":").pop() || ""); } catch { return ""; } };
const show = value => value === undefined ? "∅" : String(value);

function loadLibrary() {
  const actors = [];
  for (const pack of PACKS) for (const actor of readPack(pack)) actors.push({ pack, actor });
  const byId = new Map(actors.map(entry => [entry.actor._id, entry]));
  if (byId.size !== actors.length) throw new Error("Duplicate Actor _id across packs");
  return { actors, byId };
}

// Gate the parse against the raw page: a stat-table that yields 0 rows is either
// a parser regression or a page that genuinely has no attack table.
function statTablePresent(pageText) { return /class="powertable monster"/i.test(pageText); }

function qualityGate(parsed, oldActor, page) {
  const problems = [];
  const rows = parsed.system.combatStyles.length;
  const oldRows = oldActor.system.combatStyles?.length ?? 0;
  const table = statTablePresent(page.text);
  const weird = String(page.text ?? "").slice(0, 3000).match(/<title>([^<]+)<\/title>/)?.[1] ?? "";
  if (/\berror\b|\bnot found/i.test(weird) && !/Monster/i.test(weird)) problems.push(`page title says ${weird}`);
  if (!rows && table) problems.push("stat table present on page but parser produced 0 rows");
  if (rows && !table) problems.push("rows parsed although no stat table is visible");
  if (Number(oldActor.system.level) > 0 && parsed.system.level === 0) problems.push(`level regressed ${oldActor.system.level} → 0`);
  if (String(oldActor.system.monsterType ?? "") !== "" && parsed.system.monsterType === "") problems.push("monsterType regressed to empty");
  if (!rows && oldRows && oldRows > 0) problems.push(`rows lost: old had ${oldRows}`);
  return problems;
}

// Preserve page-absent values: never empty-out a populated field from a weaker parse.
const FIELD_FALLBACKS = ["movementSpeed","fortitude","willpower","description","source","habitat","languages","weakPoint","disposition","intelligence","perception"];
function mergeSystem(oldActor, parsed) {
  const merged = { ...parsed.system };
  merged.revealed = oldActor.system.revealed ?? false;
  for (const field of FIELD_FALLBACKS) {
    if ((merged[field] === "" || merged[field] === undefined) && (oldActor.system[field] ?? "") !== "") {
      merged[field] = oldActor.system[field];
      merged["__preserved:" + field] = true;
    }
  }
  return merged;
}

function diffSummary(oldSys, newSys) {
  const changes = [];
  const keys = new Set([...Object.keys(oldSys ?? {}), ...Object.keys(newSys)]);
  for (const key of keys) {
    const a = JSON.stringify(oldSys?.[key] ?? null);
    const b = JSON.stringify(newSys?.[key] ?? null);
    if (a !== b) changes.push({ key, before: a.length > 400 ? a.slice(0, 400) + "…" : a, after: b.length > 400 ? b.slice(0, 400) + "…" : b });
  }
  return changes;
}

async function main() {
  const { actors, byId } = loadLibrary();
  let targets;
  if (ALL) targets = actors;
  else {
    const ids = fs.readFileSync(idsFile, "utf8").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    targets = ids.map(id => byId.get(id) ?? (function(){ throw new Error(`Unknown Actor id: ${id}`); })());
  }
  const limiter = new RateLimiter(2, 350);
  const results = await limiter.runAll(targets.map(entry => async () => {
    const { pack, actor } = entry;
    const slug = slugOf(actor.system.sourceUrl);
    const base = { pack, id: actor._id, name: actor.name, slug, sourceUrl: actor.system.sourceUrl };
    if (!slug) return { ...base, status: "error", reason: "missing sourceUrl slug" };
    const page = await fetchMonsterPage(slug);
    if (page.status === "notfound") return { ...base, status: "notfound", reason: `wiki page missing (HTTP ${page.http})` };
    if (page.status === "error") return { ...base, status: "error", reason: page.http };
    const parsed = parseMonsterPage(page.text, page.url);
    const gate = qualityGate(parsed, actor, page);
    if (gate.length) return { ...base, status: "failed-gate", reason: gate.join("; ") };
    const system = mergeSystem(actor, parsed);
    const changes = diffSummary(actor.system, system);
    const nameSame = parsed.name === actor.name;
    const trivial = changes.length === 1 && changes[0].key === "revealed" || (changes.length === 1 && changes[0].key === "sourceUrl");
    return {
      ...base,
      status: changes.length ? (DRY_RUN ? "would-update" : "updated") : "nochange",
      nameStatus: nameSame ? "same" : `differs: parsed "${parsed.name}"`,
      rows: system.combatStyles.length, rowsOld: actor.system.combatStyles?.length ?? 0,
      lootNew: system.lootTable.length, lootOld: (actor.system.lootTable ?? []).length,
      skillsNew: system.uniqueSkills.length, skillsOld: (actor.system.uniqueSkills ?? []).length,
      levelOld: actor.system.level, levelNew: system.level, initOld: actor.system.initiative, initNew: system.initiative,
      changes, preserved: Object.keys(system).filter(k => k.startsWith("__preserved:")), parsed
    };
  }));

  // Apply updates pack-by-pack only when not dry-running.
  if (!DRY_RUN) {
    for (const pack of PACKS) {
      const touched = results.filter(result => result.pack === pack && result.status === "updated");
      if (!touched.length) continue;
      const parsedById = new Map(touched.map(t => [t.id, t.parsed]));
      const lines = readPack(pack).map(actor => {
        const parsed = parsedById.get(actor._id);
        if (!parsed) return JSON.stringify(actor);
        const system = parsed.system;
        // merge again against the same old system to keep preserve-fields
        return JSON.stringify({ ...actor, system: mergeSystem(actor, parsed) });
      });
      writeAtomic(path.join(packsDir, `${pack}.db`), lines.join("\n"));
      touched.length = 0;
    }
  }

  const summary = {};
  for (const result of results) summary[result.status] = (summary[result.status] ?? 0) + 1;
  console.log(JSON.stringify({ dryRun: DRY_RUN, total: results.length, summary }, null, 1));
  if (reportPath) fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), dryRun: DRY_RUN, summary, results }, null, 1), "utf8");
  if (reportMdPath) {
    const lines = [`# Regeneration log (${DRY_RUN ? "dry run" : "applied"}) — ${new Date().toISOString()}`, ""];
    for (const result of results) {
      const flag = result.status === "error" || result.status === "failed-gate" || result.status === "notfound" ? "**" : "";
      lines.push(`- ${flag}${result.status}${flag} | ${result.pack} | ${result.name} (${result.slug}) | rows ${result.rowsOld ?? "?"}→${result.rows ?? "?"} | loot ${result.lootOld ?? "?"}→${result.lootNew ?? "?"}${result.reason ? ` | ${result.reason}` : ""}${result.nameStatus && result.nameStatus !== "same" ? ` | name ${result.nameStatus}` : ""}`);
    }
    fs.writeFileSync(reportMdPath, lines.join("\n"), "utf8");
  }
  return results;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
