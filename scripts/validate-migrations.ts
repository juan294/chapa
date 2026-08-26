#!/usr/bin/env node
/**
 * validate-migrations.ts
 *
 * Reads supabase/migrations/ and verifies that:
 * 1. All files follow the naming convention: NNN_<description>.sql (3-digit zero-padded prefix)
 * 2. The sequence is contiguous starting from 001 (no gaps, no duplicates)
 *
 * Run: pnpm run validate:migrations
 * Or:  node scripts/validate-migrations.ts
 *
 * Exits 0 on success, 1 on any validation failure.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, "..", "supabase", "migrations");

const EXPECTED_PATTERN = /^(\d{3})_[a-z0-9][a-z0-9_]*\.sql$/;

function main(): void {
  console.log(`Validating migrations in: ${MIGRATIONS_DIR}\n`);

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`ERROR: Migrations directory not found: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  const entries = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => !f.startsWith("."))
    .sort();

  if (entries.length === 0) {
    console.log("No migration files found. Nothing to validate.");
    process.exit(0);
  }

  const errors: string[] = [];
  const seenNumbers = new Map<number, string>();

  for (const filename of entries) {
    const match = EXPECTED_PATTERN.exec(filename);
    if (!match) {
      errors.push(
        `  INVALID NAME: "${filename}" — expected format NNN_description.sql (e.g. 001_create_tables.sql)`
      );
      continue;
    }

    const prefix = match[1]!;
    const num = parseInt(prefix, 10);
    if (seenNumbers.has(num)) {
      errors.push(
        `  DUPLICATE PREFIX: "${filename}" has the same number (${prefix}) as "${seenNumbers.get(num)}"`
      );
      continue;
    }

    seenNumbers.set(num, filename);
  }

  // Check contiguous sequence starting from 1
  const sortedNumbers = [...seenNumbers.keys()].sort((a, b) => a - b);
  for (let i = 0; i < sortedNumbers.length; i++) {
    const expected = i + 1;
    const actual = sortedNumbers[i];
    if (actual !== expected) {
      const paddedExpected = String(expected).padStart(3, "0");
      errors.push(
        `  GAP IN SEQUENCE: expected migration ${paddedExpected} but found ${String(actual).padStart(3, "0")} — migrations must be sequential without gaps`
      );
    }
  }

  // Report results
  console.log(`Found ${entries.length} migration file(s):\n`);
  for (const filename of entries) {
    const hasError = errors.some((e) => e.includes(`"${filename}"`));
    const icon = hasError ? "  [FAIL]" : "  [OK]  ";
    console.log(`${icon} ${filename}`);
  }

  console.log();

  if (errors.length > 0) {
    console.error(`VALIDATION FAILED — ${errors.length} error(s):\n`);
    for (const err of errors) {
      console.error(err);
    }
    console.error(
      "\nFix the issues above before applying migrations to Supabase."
    );
    console.error(
      "See docs/runbooks/migrations.md for the manual apply process."
    );
    process.exit(1);
  }

  console.log(
    `All ${entries.length} migrations valid. Sequence: 001 → ${String(sortedNumbers[sortedNumbers.length - 1]).padStart(3, "0")}.`
  );
  process.exit(0);
}

main();
