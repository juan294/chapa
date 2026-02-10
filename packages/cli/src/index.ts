#!/usr/bin/env node

import { parseArgs } from "./cli.js";
import { resolveToken } from "./auth.js";
import { fetchEmuStats } from "./fetch-emu.js";
import { uploadSupplementalStats } from "./upload.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.command !== "merge") {
    console.error("Usage: chapa merge --handle <personal> --emu-handle <emu> [--emu-token <token>] [--token <token>] [--server <url>]");
    process.exit(1);
  }

  const handle = args.handle;
  const emuHandle = args.emuHandle;

  if (!handle || !emuHandle) {
    console.error("Error: --handle and --emu-handle are required.");
    process.exit(1);
  }

  // Resolve tokens
  const emuToken = resolveToken(args.emuToken, "GITHUB_EMU_TOKEN");
  if (!emuToken) {
    console.error("Error: EMU token required. Use --emu-token, set GITHUB_EMU_TOKEN, or ensure `gh auth token` works.");
    process.exit(1);
  }

  const personalToken = resolveToken(args.token, "GITHUB_TOKEN");
  if (!personalToken) {
    console.error("Error: Personal token required. Use --token, set GITHUB_TOKEN, or ensure `gh auth token` works.");
    process.exit(1);
  }

  // Fetch EMU stats
  console.log(`Fetching stats for EMU account: ${emuHandle}...`);
  const emuStats = await fetchEmuStats(emuHandle, emuToken);
  if (!emuStats) {
    console.error("Error: Failed to fetch EMU stats. Check your EMU token and handle.");
    process.exit(1);
  }

  console.log(`Found: ${emuStats.commitsTotal} commits, ${emuStats.prsMergedCount} PRs merged, ${emuStats.reviewsSubmittedCount} reviews`);

  // Upload to Chapa
  console.log(`Uploading supplemental stats to ${args.server}...`);
  const result = await uploadSupplementalStats({
    targetHandle: handle,
    sourceHandle: emuHandle,
    stats: emuStats,
    token: personalToken,
    serverUrl: args.server,
  });

  if (!result.success) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }

  console.log("Success! Supplemental stats uploaded. Your badge will reflect combined data on next refresh.");
}

main();
