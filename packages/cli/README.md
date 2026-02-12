# chapa-cli

Merge GitHub EMU (Enterprise Managed User) contributions into your [Chapa](https://chapa.thecreativetoken.com) developer impact badge.

If your employer uses GitHub EMU accounts, your work contributions are invisible on your personal profile. This CLI fetches your EMU stats and uploads them to Chapa so your badge reflects your full impact.

## Usage

```bash
npx chapa-cli merge \
  --handle your-personal-handle \
  --emu-handle your-emu-handle
```

## Options

| Flag | Description | Required |
|------|-------------|----------|
| `--handle <handle>` | Your personal GitHub handle | Yes |
| `--emu-handle <handle>` | Your EMU GitHub handle | Yes |
| `--emu-token <token>` | EMU GitHub token | No* |
| `--token <token>` | Personal GitHub token | No* |
| `--server <url>` | Chapa server URL | No |
| `--version`, `-v` | Show version number | |
| `--help`, `-h` | Show help message | |

*Tokens are resolved in order: flag > environment variable > `gh auth token`.

## Token setup

Set tokens via environment variables to avoid passing them on every run:

```bash
export GITHUB_TOKEN=ghp_your_personal_token
export GITHUB_EMU_TOKEN=ghp_your_emu_token
```

Tokens need the `read:user` scope at minimum.

## How it works

1. Fetches your last 12 months of activity from the EMU account via GitHub GraphQL API
2. Uploads the stats (commits, PRs merged, reviews) to the Chapa server
3. Your Chapa badge recalculates on next refresh, combining personal + EMU contributions

## License

MIT
