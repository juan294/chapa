# Chapa CLI — User Manual

> Merge your GitHub Enterprise (EMU) contributions into your personal Chapa badge.

## What this solves

If your employer uses GitHub Enterprise Managed Users (EMU), your work contributions are invisible on your personal GitHub profile. The Chapa CLI fetches your EMU activity and merges it into your Chapa badge so it reflects your full developer impact.

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [Authentication](#3-authentication)
4. [EMU token setup](#4-emu-token-setup)
5. [Running the CLI](#5-running-the-cli)
6. [Verifying it worked](#6-verifying-it-worked)
7. [Corporate environment guide](#7-corporate-environment-guide)
8. [Troubleshooting](#8-troubleshooting)
9. [Reference](#9-reference)

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
chapa-cli v0.2.4

Merge GitHub EMU (Enterprise Managed User) contributions into your Chapa badge.

Commands:
  chapa login                          Authenticate with Chapa (opens browser)
  chapa logout                         Clear stored credentials
  chapa merge --emu-handle <emu>       Merge EMU stats into your badge

Options:
  --emu-handle <handle>   Your EMU GitHub handle (required for merge)
  --emu-token <token>     EMU GitHub token (or set GITHUB_EMU_TOKEN)
  --handle <handle>       Override personal handle (auto-detected from login)
  --token <token>         Override auth token (auto-detected from login)
  --server <url>          Chapa server URL (default: https://chapa.thecreativetoken.com)
  --verbose               Show detailed polling logs during login
  --insecure              Skip TLS certificate verification (corporate networks)
  --version, -v           Show version number
  --help, -h              Show this help message
```

---

## 3. Authentication

The CLI uses browser-based authentication — similar to `npm login` or `gh auth login`. No personal GitHub token is needed.

> **Important: Use your personal GitHub account.** The login step requires your **personal** GitHub account (the one linked to your Chapa badge), not your work/EMU account. If you're on a work computer where the default browser is logged into your EMU account, copy the URL and open it in:
> - A **different browser** where your personal GitHub is logged in (e.g., Safari if you use Chrome for work)
> - An **incognito/private window** and log in with your personal GitHub credentials

### Log in

```bash
npx chapa-cli login
```

The CLI will display a URL — copy it and open it in the browser where your **personal** GitHub account is logged in:

```
Open this URL in a browser where your personal GitHub account is logged in:

  https://chapa.thecreativetoken.com/cli/authorize?session=...

Tip: If your default browser has your work (EMU) account,
     use a different browser or an incognito/private window.

Waiting for approval...
```

Once you open the URL:

1. Sign in with your **personal** GitHub account (if not already signed in)
2. Click **"Authorize CLI"** to approve
3. The CLI automatically detects the approval and saves your credentials

```
Logged in as juan294!
Credentials saved to ~/.chapa/credentials.json
```

Your credentials are stored locally at `~/.chapa/credentials.json` with restricted file permissions (readable only by you). The token expires after 90 days — just run `chapa login` again to refresh.

### Log out

```bash
npx chapa-cli logout
```

This removes the stored credentials from `~/.chapa/credentials.json`.

### Check if you're logged in

If you run `chapa merge` without being logged in, the CLI will tell you:

```
Error: Not authenticated. Run 'chapa login' first, or pass --token.
```

---

## 4. EMU token setup

You need **one token** — from your EMU (work) GitHub account. This allows the CLI to read your work contributions.

### Create an EMU token

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
8. **Copy the token immediately** — you won't see it again

> **Important:** Some organizations require admin approval for Personal Access Tokens. If token creation is blocked, check with your IT/security team. You may need to use a Fine-Grained Personal Access Token instead — see [Troubleshooting](#cannot-create-a-token-on-emu-account).

### Store the token as an environment variable

Instead of passing the token on every run, store it in your shell profile.

**macOS / Linux** — Add to `~/.zshrc`, `~/.bashrc`, or `~/.bash_profile`:

```bash
export GITHUB_EMU_TOKEN="ghp_your_emu_token_here"
```

Then reload your shell:

```bash
source ~/.zshrc   # or ~/.bashrc
```

**Windows (PowerShell)** — Add to your PowerShell profile (`$PROFILE`):

```powershell
$env:GITHUB_EMU_TOKEN = "ghp_your_emu_token_here"
```

Or set it permanently via System Properties > Environment Variables.

**Windows (CMD)**:

```cmd
setx GITHUB_EMU_TOKEN "ghp_your_emu_token_here"
```

> **Security note:** Tokens in environment variables are visible to any process running under your user. If your corporate policy prohibits this, pass the token as a flag instead (see section 5).

### Verify the token works

```bash
curl -s -H "Authorization: Bearer $GITHUB_EMU_TOKEN" https://api.github.com/user | grep login
```

Should print your EMU GitHub username. If it returns an error, see [Troubleshooting](#token-returns-401-unauthorized).

---

## 5. Running the CLI

### Step 1: Log in with your personal GitHub (one time)

```bash
npx chapa-cli login
```

> **This is the same personal GitHub login from [Step 3](#3-authentication).** If you already logged in there, skip this — your credentials are still saved. This login uses your **personal** GitHub account (not your EMU/work account). The EMU token from Step 4 handles your work contributions separately.

### Step 2: Merge EMU stats

```bash
npx chapa-cli merge --emu-handle juan294-corp
```

Replace `juan294-corp` with your **EMU** GitHub handle.

That's it! Your personal handle and auth token are automatically loaded from the login step.

### Passing the EMU token as a flag (no env var)

```bash
npx chapa-cli merge \
  --emu-handle juan294-corp \
  --emu-token ghp_your_emu_token
```

### Overriding the personal handle

If your Chapa handle differs from what was saved during login:

```bash
npx chapa-cli merge \
  --emu-handle juan294-corp \
  --handle my-other-handle
```

### Custom server URL (for testing)

```bash
npx chapa-cli merge \
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

## 6. Verifying it worked

After running the CLI:

1. Go to your Chapa share page: `https://chapa.thecreativetoken.com/u/<your-handle>`
2. Your badge should update on the next refresh (within 24 hours, or force-refresh if available)
3. The stats should now include your EMU contributions (higher commit count, more PRs, etc.)

---

## 7. Corporate environment guide

Corporate machines often have restrictions that can interfere with npm and GitHub API access. This section covers common scenarios.

### 7.1 Behind a corporate proxy

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

### 7.2 Corporate firewall blocking domains

The CLI needs access to these domains:

| Domain | Purpose | Required |
|--------|---------|----------|
| `api.github.com` | Fetch EMU stats via GraphQL API | Yes |
| `chapa.thecreativetoken.com` | Authentication + upload merged stats | Yes |
| `registry.npmjs.org` | Download the CLI package (npx/npm install) | For installation only |

**If any are blocked**, ask your IT team to allowlist them. If `registry.npmjs.org` is blocked but you have a corporate npm registry (Artifactory, Nexus), you can configure npm to use it:

```bash
npm config set registry https://npm.yourcompany.com/
```

### 7.3 Self-signed SSL certificates (TLS interception)

Many corporate networks perform TLS interception (man-in-the-middle) by replacing SSL certificates with corporate CA-signed ones. This causes Node.js to reject the connection because it doesn't trust the corporate CA.

**Symptoms:**
- `UNABLE_TO_VERIFY_LEAF_SIGNATURE` errors
- `SELF_SIGNED_CERT_IN_CHAIN` errors
- `CERT_HAS_EXPIRED` errors
- `DEPTH_ZERO_SELF_SIGNED_CERT` errors
- `chapa login` hangs or fails with TLS errors

**Quick fix — Use the `--insecure` flag:**

```bash
npx chapa-cli login --insecure
```

This disables TLS certificate verification for the login session only. The CLI will warn you and automatically re-enable verification after login completes. The flag also works with `merge`:

```bash
npx chapa-cli merge --emu-handle juan294-corp --insecure
```

> **Note:** The CLI auto-detects TLS errors. If you see a TLS error without `--insecure`, the CLI will suggest it automatically.

**Proper fix — Tell Node.js to trust your corporate CA:**

```bash
export NODE_EXTRA_CA_CERTS="/path/to/corporate-ca-bundle.pem"
```

Ask your IT team for the CA certificate file. Common locations:
- macOS: `/usr/local/share/ca-certificates/`
- Linux: `/etc/ssl/certs/ca-certificates.crt`
- Windows: Export from Certificate Manager (`certmgr.msc`)

**Manual last resort (not recommended for production):**

```bash
export NODE_TLS_REJECT_UNAUTHORIZED=0
npm config set strict-ssl false
```

This disables certificate verification for all Node.js processes. Prefer `--insecure` which scopes the bypass to the CLI session only.

### 7.4 Restricted Node.js installation

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

### 7.5 VPN-related issues

If you're on a corporate VPN:

- The VPN may split-tunnel, routing only company traffic through the VPN. GitHub API and Chapa should work normally in this case.
- If the VPN routes ALL traffic, the proxy/firewall rules from sections 7.1-7.2 apply.
- Some VPNs cause DNS resolution issues. Try using explicit DNS:
  ```bash
  # Test if DNS resolves
  nslookup api.github.com
  nslookup chapa.thecreativetoken.com
  ```

### 7.6 GitHub Enterprise Server (on-premise)

If your company runs GitHub Enterprise Server (not github.com), the CLI currently targets `api.github.com`. On-premise GitHub Enterprise uses a different API URL (e.g., `https://github.yourcompany.com/api/graphql`). This is **not yet supported** — let us know if you need it and we can add a `--github-api-url` flag.

### 7.7 EMU token restrictions

Some organizations restrict what tokens EMU accounts can create:

- **Personal Access Tokens may be disabled** — The org admin can disable classic PATs. Try Fine-Grained tokens instead.
- **IP allowlisting** — The org may restrict API access to specific IPs. You may need to run the CLI from the corporate network (on VPN).
- **SSO enforcement** — After creating the token, you may need to "Authorize" it for SSO. Go to [github.com/settings/tokens](https://github.com/settings/tokens) and click "Enable SSO" next to your token, then authorize it for your organization.

### 7.8 Browser doesn't open during login

If `chapa login` doesn't open your browser automatically:

1. Copy the URL printed in the terminal
2. Open it manually in any browser
3. The CLI will detect the approval automatically once you click "Authorize CLI"

On headless servers or remote machines, you can open the URL on a different machine — the CLI polls the server regardless of which browser you use.

---

## 8. Troubleshooting

### `npx chapa-cli` hangs or fails to download

**Try installing globally instead:**
```bash
npm install -g chapa-cli
chapa merge --emu-handle <emu>
```

**If behind a proxy**, see [section 7.1](#71-behind-a-corporate-proxy).

### Token returns 401 Unauthorized

1. **Check the token hasn't expired** — Go to GitHub Settings > Tokens and verify
2. **Check SSO authorization** — For EMU tokens in SSO-enabled orgs, you need to authorize the token. Go to your token settings and click "Enable SSO"
3. **Check scopes** — The token needs at least `read:user`

### `Error: Failed to fetch EMU stats`

- Verify your EMU handle is correct (case-sensitive)
- Test the token manually:
  ```bash
  curl -s -H "Authorization: Bearer $GITHUB_EMU_TOKEN" \
    https://api.github.com/user | grep login
  ```
- If your EMU account is on GitHub Enterprise Server (not github.com), the CLI does not support custom API URLs yet

### `Error: Not authenticated. Run 'chapa login' first`

Run `chapa login` to authenticate via your browser. If you've logged in before but see this error, your token may have expired (90-day expiry). Log in again.

### `chapa login` hangs or shows TLS errors

If `chapa login` starts polling but never completes, or fails with certificate errors:

1. **On a corporate network?** Try `chapa login --insecure` — corporate TLS interception is the most common cause
2. **Use `--verbose` for diagnostics:** `chapa login --verbose` shows each poll attempt and its result, helping pinpoint where the connection fails
3. **Check network access** to `chapa.thecreativetoken.com`:
   ```bash
   curl -v https://chapa.thecreativetoken.com/api/health
   ```
4. See [section 7.3](#73-self-signed-ssl-certificates-tls-interception) for the full corporate TLS guide

### `ECONNREFUSED` or `ETIMEDOUT`

- Check your internet connection
- If behind a proxy/VPN, see [section 7](#7-corporate-environment-guide)
- Check if the target domains are accessible:
  ```bash
  curl -s https://api.github.com/zen          # Should print a random quote
  curl -s https://chapa.thecreativetoken.com/api/health  # Should return JSON
  ```

### `Error: Server returned 403`

- Your auth token may have expired — run `chapa login` again
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

## 9. Reference

### Commands

| Command | Description |
|---------|-------------|
| `chapa login` | Authenticate with Chapa (opens browser) |
| `chapa logout` | Clear stored credentials |
| `chapa merge` | Merge EMU stats into your badge |

### All flags

| Flag | Short | Applies to | Description | Default |
|------|-------|-----------|-------------|---------|
| `--emu-handle` | | `merge` | EMU GitHub handle | (required) |
| `--emu-token` | | `merge` | EMU token | `$GITHUB_EMU_TOKEN` |
| `--handle` | | `merge` | Override personal handle | Auto-detected from login |
| `--token` | | `merge` | Override auth token | Auto-detected from login |
| `--server` | | all | Chapa server URL | `https://chapa.thecreativetoken.com` |
| `--verbose` | | `login` | Show detailed polling logs | `false` |
| `--insecure` | | `login`, `merge` | Skip TLS certificate verification | `false` |
| `--version` | `-v` | all | Print version | |
| `--help` | `-h` | all | Print help | |

### Token resolution order

**Auth token** (for uploading to Chapa):

1. `--token` flag
2. Saved credentials from `chapa login` (`~/.chapa/credentials.json`)
3. Error — run `chapa login` first

**EMU token** (for reading EMU stats):

1. `--emu-token` flag
2. `GITHUB_EMU_TOKEN` environment variable
3. Error — token is required

### What data is collected

The CLI reads the following from your EMU account (last 12 months):

- Contribution calendar (commit counts per day)
- Pull requests authored (count, additions, deletions, files changed)
- Pull request reviews submitted (count)
- Issue contributions (count)
- Repository count

This data is uploaded to the Chapa server and merged with your personal account stats. No source code, commit messages, or repository names are accessed.

### Credential storage

Login credentials are stored at `~/.chapa/credentials.json` with restricted permissions:
- Directory: `0700` (owner only)
- File: `0600` (owner read/write only)

The file contains your Chapa handle, server URL, and a signed authentication token (not your GitHub password or OAuth token).

### Environment variables

| Variable | Purpose |
|----------|---------|
| `GITHUB_EMU_TOKEN` | EMU GitHub token |
| `HTTPS_PROXY` | Corporate proxy URL |
| `NODE_EXTRA_CA_CERTS` | Path to corporate CA certificate |
| `NODE_TLS_REJECT_UNAUTHORIZED` | Set to `0` to skip SSL verification (not recommended) |
