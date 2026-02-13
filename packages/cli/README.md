# chapa-cli

Merge GitHub EMU (Enterprise Managed User) contributions into your [Chapa](https://chapa.thecreativetoken.com) developer impact badge.

If your employer uses GitHub EMU accounts, your work contributions are invisible on your personal profile. This CLI fetches your EMU stats and uploads them to Chapa so your badge reflects your full impact.

## Quick start

```bash
# 1. Authenticate with Chapa (opens browser)
npx chapa-cli login

# 2. Merge your EMU stats
npx chapa-cli merge --emu-handle your-emu-handle
```

That's it! Your personal handle and auth token are auto-detected from the login step.

## Commands

| Command | Description |
|---------|-------------|
| `chapa login` | Authenticate via browser (like `npm login`) |
| `chapa logout` | Clear stored credentials |
| `chapa merge` | Fetch EMU stats and upload to Chapa |

## Options (for merge)

| Flag | Description | Required |
|------|-------------|----------|
| `--emu-handle <handle>` | Your EMU GitHub handle | Yes |
| `--emu-token <token>` | EMU GitHub token | No* |
| `--handle <handle>` | Override personal handle | No |
| `--token <token>` | Override auth token | No |
| `--server <url>` | Chapa server URL | No |
| `--version`, `-v` | Show version number | |
| `--help`, `-h` | Show help message | |

*EMU token is resolved from: flag > `GITHUB_EMU_TOKEN` env var.

## EMU token setup

You need one token from your EMU (work) GitHub account with `read:user` scope:

```bash
export GITHUB_EMU_TOKEN=ghp_your_emu_token
```

## How it works

1. `chapa login` opens your browser for OAuth authentication with Chapa
2. After approval, a signed CLI token is saved to `~/.chapa/credentials.json`
3. `chapa merge` fetches your last 12 months of EMU activity via GitHub GraphQL API
4. Stats (commits, PRs merged, reviews) are uploaded to the Chapa server
5. Your badge recalculates on next refresh, combining personal + EMU contributions

## License

MIT
