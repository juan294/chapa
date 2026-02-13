# Chapa CLI — User Manual

> Merge your GitHub Enterprise (EMU) contributions into your personal Chapa badge.

## What this solves

If your employer uses GitHub Enterprise Managed Users (EMU), your work contributions are invisible on your personal GitHub profile. The Chapa CLI fetches your EMU activity and merges it into your Chapa badge so it reflects your full developer impact.

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [Token setup](#3-token-setup)
4. [Running the CLI](#4-running-the-cli)
5. [Verifying it worked](#5-verifying-it-worked)
6. [Corporate environment guide](#6-corporate-environment-guide)
7. [Troubleshooting](#7-troubleshooting)
8. [Reference](#8-reference)

---

## 1. Prerequisites

- **Node.js 18 or later** — Check with `node --version`
- **npm 7 or later** — Comes with Node.js. Check with `npm --version`
- **A Chapa account** — Sign in at [chapa.thecreativetoken.com](https://chapa.thecreativetoken.com) with your personal GitHub account
- **Access to your EMU GitHub account** — You need to be able to create a Personal Access Token on it

### Check your setup

```bash
node --version    # Should print v18.x.x or higher
npm --version     # Should print 7.x.x or higher
```

If Node.js is not installed, download it from [nodejs.org](https://nodejs.org/) (LTS recommended). On corporate machines, you may need to request installation through your IT department or use a version manager like `nvm` if allowed.

---

## 2. Installation

### Option A: Run without installing (recommended)

```bash
npx chapa-cli --version
```

This downloads and runs the CLI on the fly. Nothing is permanently installed. Best for one-off use.

### Option B: Install globally

```bash
npm install -g chapa-cli
```

Then run with:

```bash
chapa --version
```

### Option C: Install locally in a project

```bash
npm install chapa-cli
npx chapa --version
```

### Verify the installation

Whichever method you chose, run:

```bash
npx chapa-cli --help
```

You should see:

```
chapa-cli v0.1.4

Merge GitHub EMU (Enterprise Managed User) contributions into your Chapa badge.

Usage:
  chapa merge --handle <personal> --emu-handle <emu> [options]

Options:
  --handle <handle>       Your personal GitHub handle (required)
  --emu-handle <handle>   Your EMU GitHub handle (required)
  --emu-token <token>     EMU GitHub token (or set GITHUB_EMU_TOKEN)
  --token <token>         Personal GitHub token (or set GITHUB_TOKEN)
  --server <url>          Chapa server URL (default: https://chapa.thecreativetoken.com)
  --version, -v           Show version number
  --help, -h              Show this help message
```

---

## 3. Token setup

You need **two GitHub tokens** — one from your personal account and one from your EMU account. Each token needs specific permissions to read your activity.

### 3.1 Personal GitHub token

This authenticates you as the owner of your Chapa badge.

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens) (make sure you are logged into your **personal** GitHub account)
2. Click **"Generate new token (classic)"**
3. Give it a descriptive name: `Chapa CLI - Personal`
4. Set expiration to 90 days (or longer if you prefer)
5. Select these scopes:
   - `read:user` (required)
6. Click **"Generate token"**
7. **Copy the token immediately** — you won't see it again

### 3.2 EMU GitHub token

This allows the CLI to read your work contributions.

1. Log into your **EMU GitHub account** (usually `https://github.com` with your corporate SSO, or your company's GitHub Enterprise URL)
2. Go to **Settings > Developer settings > Personal access tokens > Tokens (classic)**
   - Direct URL: `https://github.com/settings/tokens` (while logged into your EMU account)
3. Click **"Generate new token (classic)"**
4. Name it: `Chapa CLI - EMU`
5. Set expiration to 90 days
6. Select these scopes:
   - `read:user` (required)
   - `read:org` (may be required if your org restricts token access)
7. Click **"Generate token"**
8. **Copy the token immediately**

> **Important:** Some organizations require admin approval for Personal Access Tokens. If token creation is blocked, check with your IT/security team. You may need to use a Fine-Grained Personal Access Token instead — see [Troubleshooting](#cannot-create-a-token-on-emu-account).

### 3.3 Store tokens as environment variables

Instead of passing tokens on every run, store them in your shell profile.

**macOS / Linux** — Add to `~/.zshrc`, `~/.bashrc`, or `~/.bash_profile`:

```bash
export GITHUB_TOKEN="ghp_your_personal_token_here"
export GITHUB_EMU_TOKEN="ghp_your_emu_token_here"
```

Then reload your shell:

```bash
source ~/.zshrc   # or ~/.bashrc
```

**Windows (PowerShell)** — Add to your PowerShell profile (`$PROFILE`):

```powershell
$env:GITHUB_TOKEN = "ghp_your_personal_token_here"
$env:GITHUB_EMU_TOKEN = "ghp_your_emu_token_here"
```

Or set them permanently via System Properties > Environment Variables.

**Windows (CMD)**:

```cmd
setx GITHUB_TOKEN "ghp_your_personal_token_here"
setx GITHUB_EMU_TOKEN "ghp_your_emu_token_here"
```

> **Security note:** Tokens in environment variables are visible to any process running under your user. If your corporate policy prohibits this, pass them as flags instead (see section 4).

### 3.4 Verify tokens work

Test your personal token:

```bash
curl -s -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user | grep login
```

Should print your personal GitHub username.

Test your EMU token:

```bash
curl -s -H "Authorization: Bearer $GITHUB_EMU_TOKEN" https://api.github.com/user | grep login
```

Should print your EMU GitHub username.

If either returns an error, see [Troubleshooting](#token-returns-401-unauthorized).

---

## 4. Running the CLI

### Basic usage (with env vars set)

```bash
npx chapa-cli merge --handle juan294 --emu-handle juan294-corp
```

Replace:
- `juan294` with your **personal** GitHub handle
- `juan294-corp` with your **EMU** GitHub handle

### Passing tokens as flags (no env vars)

```bash
npx chapa-cli merge \
  --handle juan294 \
  --emu-handle juan294-corp \
  --emu-token ghp_your_emu_token \
  --token ghp_your_personal_token
```

### Custom server URL (for testing)

```bash
npx chapa-cli merge \
  --handle juan294 \
  --emu-handle juan294-corp \
  --server http://localhost:3001
```

### Expected output

```
Fetching stats for EMU account: juan294-corp...
Found: 142 commits, 23 PRs merged, 45 reviews
Uploading supplemental stats to https://chapa.thecreativetoken.com...
Success! Supplemental stats uploaded. Your badge will reflect combined data on next refresh.
```

---

## 5. Verifying it worked

After running the CLI:

1. Go to your Chapa share page: `https://chapa.thecreativetoken.com/u/<your-handle>`
2. Your badge should update on the next refresh (within 24 hours, or force-refresh if available)
3. The stats should now include your EMU contributions (higher commit count, more PRs, etc.)

---

## 6. Corporate environment guide

Corporate machines often have restrictions that can interfere with npm and GitHub API access. This section covers common scenarios.

### 6.1 Behind a corporate proxy

If your company routes internet traffic through a proxy, npm and the CLI may fail to connect.

**Symptoms:**
- `npm ERR! network` errors
- `ETIMEDOUT` or `ECONNREFUSED` when running the CLI
- `npx` hangs and never completes

**Fix — Configure npm to use the proxy:**

```bash
npm config set proxy http://proxy.yourcompany.com:8080
npm config set https-proxy http://proxy.yourcompany.com:8080
```

Ask your IT team for the proxy URL and port. Some companies use `http://proxy:3128`, `http://proxy:8080`, or a PAC file URL.

**If your proxy requires authentication:**

```bash
npm config set proxy http://username:password@proxy.yourcompany.com:8080
npm config set https-proxy http://username:password@proxy.yourcompany.com:8080
```

**For the CLI itself (GitHub API calls):**

The CLI uses Node.js `fetch()` which respects the `HTTPS_PROXY` environment variable:

```bash
export HTTPS_PROXY=http://proxy.yourcompany.com:8080
```

### 6.2 Corporate firewall blocking domains

The CLI needs access to two domains:

| Domain | Purpose | Required |
|--------|---------|----------|
| `api.github.com` | Fetch EMU stats via GraphQL API | Yes |
| `chapa.thecreativetoken.com` | Upload merged stats | Yes |
| `registry.npmjs.org` | Download the CLI package (npx/npm install) | For installation only |

**If any are blocked**, ask your IT team to allowlist them. If `registry.npmjs.org` is blocked but you have a corporate npm registry (Artifactory, Nexus), you can configure npm to use it:

```bash
npm config set registry https://npm.yourcompany.com/
```

### 6.3 Self-signed SSL certificates

Some corporate proxies use self-signed certificates for TLS inspection.

**Symptoms:**
- `SELF_SIGNED_CERT_IN_CHAIN` errors
- `UNABLE_TO_VERIFY_LEAF_SIGNATURE` errors

**Fix — Tell Node.js to trust your corporate CA:**

```bash
export NODE_EXTRA_CA_CERTS="/path/to/corporate-ca-bundle.pem"
```

Ask your IT team for the CA certificate file. Common locations:
- macOS: `/usr/local/share/ca-certificates/`
- Linux: `/etc/ssl/certs/ca-certificates.crt`
- Windows: Export from Certificate Manager (`certmgr.msc`)

**Last resort (not recommended for production):**

```bash
export NODE_TLS_REJECT_UNAUTHORIZED=0
npm config set strict-ssl false
```

This disables certificate verification entirely. Only use this for testing.

### 6.4 Restricted Node.js installation

If you cannot install Node.js system-wide, options:

1. **nvm (Node Version Manager)** — Installs Node.js in your home directory, no admin rights needed:
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
   nvm install 18
   ```

2. **Portable Node.js** — Download the binary from [nodejs.org](https://nodejs.org/en/download/) and extract it to a directory you have write access to. Add the `bin/` directory to your `PATH`.

3. **Docker** — If Docker is available:
   ```bash
   docker run --rm -it node:18-slim npx chapa-cli --version
   ```

### 6.5 VPN-related issues

If you're on a corporate VPN:

- The VPN may split-tunnel, routing only company traffic through the VPN. GitHub API and Chapa should work normally in this case.
- If the VPN routes ALL traffic, the proxy/firewall rules from sections 6.1-6.2 apply.
- Some VPNs cause DNS resolution issues. Try using explicit DNS:
  ```bash
  # Test if DNS resolves
  nslookup api.github.com
  nslookup chapa.thecreativetoken.com
  ```

### 6.6 GitHub Enterprise Server (on-premise)

If your company runs GitHub Enterprise Server (not github.com), the CLI currently targets `api.github.com`. On-premise GitHub Enterprise uses a different API URL (e.g., `https://github.yourcompany.com/api/graphql`). This is **not yet supported** — let us know if you need it and we can add a `--github-api-url` flag.

### 6.7 EMU token restrictions

Some organizations restrict what tokens EMU accounts can create:

- **Personal Access Tokens may be disabled** — The org admin can disable classic PATs. Try Fine-Grained tokens instead.
- **IP allowlisting** — The org may restrict API access to specific IPs. You may need to run the CLI from within the corporate network (on VPN).
- **SSO enforcement** — After creating the token, you may need to "Authorize" it for SSO. Go to [github.com/settings/tokens](https://github.com/settings/tokens) and click "Enable SSO" next to your token, then authorize it for your organization.

---

## 7. Troubleshooting

### `npx chapa-cli` hangs or fails to download

**Try installing globally instead:**
```bash
npm install -g chapa-cli
chapa merge --handle <personal> --emu-handle <emu>
```

**If behind a proxy**, see [section 6.1](#61-behind-a-corporate-proxy).

### Token returns 401 Unauthorized

1. **Check the token hasn't expired** — Go to GitHub Settings > Tokens and verify
2. **Check you're using the right token for the right account** — EMU token for `--emu-token`, personal token for `--token`
3. **Check SSO authorization** — For EMU tokens in SSO-enabled orgs, you need to authorize the token. Go to your token settings and click "Enable SSO"
4. **Check scopes** — The token needs at least `read:user`

### `Error: Failed to fetch EMU stats`

- Verify your EMU handle is correct (case-sensitive)
- Test the token manually:
  ```bash
  curl -s -H "Authorization: Bearer $GITHUB_EMU_TOKEN" \
    https://api.github.com/user | grep login
  ```
- If your EMU account is on GitHub Enterprise Server (not github.com), the CLI does not support custom API URLs yet

### `ECONNREFUSED` or `ETIMEDOUT`

- Check your internet connection
- If behind a proxy/VPN, see [section 6](#6-corporate-environment-guide)
- Check if the target domains are accessible:
  ```bash
  curl -s https://api.github.com/zen          # Should print a random quote
  curl -s https://chapa.thecreativetoken.com/api/health  # Should return JSON
  ```

### `Error: Server returned 403`

- Your personal token may lack the required scope
- The Chapa server may be rate-limiting requests — wait a minute and try again

### Cannot create a token on EMU account

Some orgs disable classic Personal Access Tokens. Try:

1. **Fine-Grained Personal Access Token** — Go to Settings > Developer settings > Fine-grained tokens
2. Set "Resource owner" to your organization
3. Under "Permissions", grant **read** access to:
   - Account permissions > Profile (read)
4. Request approval from your org admin if required

### Windows-specific: `'npx' is not recognized`

Ensure Node.js is in your PATH:
```cmd
where node
where npm
```

If not found, reinstall Node.js and check "Add to PATH" during installation.

---

## 8. Reference

### Command syntax

```
chapa merge --handle <personal> --emu-handle <emu> [options]
```

### All flags

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--handle` | | Personal GitHub handle | (required) |
| `--emu-handle` | | EMU GitHub handle | (required) |
| `--emu-token` | | EMU token | `$GITHUB_EMU_TOKEN` |
| `--token` | | Personal token | `$GITHUB_TOKEN` |
| `--server` | | Chapa server URL | `https://chapa.thecreativetoken.com` |
| `--version` | `-v` | Print version | |
| `--help` | `-h` | Print help | |

### Token resolution order

For both `--token` and `--emu-token`:

1. Flag value (e.g., `--emu-token ghp_abc`)
2. Environment variable (`GITHUB_EMU_TOKEN` / `GITHUB_TOKEN`)
3. Error — token is required

### What data is collected

The CLI reads the following from your EMU account (last 12 months):

- Contribution calendar (commit counts per day)
- Pull requests authored (count, additions, deletions, files changed)
- Pull request reviews submitted (count)
- Issue contributions (count)
- Repository count

This data is uploaded to the Chapa server and merged with your personal account stats. No source code, commit messages, or repository names are accessed.

### Environment variables

| Variable | Purpose |
|----------|---------|
| `GITHUB_TOKEN` | Personal GitHub token |
| `GITHUB_EMU_TOKEN` | EMU GitHub token |
| `HTTPS_PROXY` | Corporate proxy URL |
| `NODE_EXTRA_CA_CERTS` | Path to corporate CA certificate |
| `NODE_TLS_REJECT_UNAUTHORIZED` | Set to `0` to skip SSL verification (not recommended) |
