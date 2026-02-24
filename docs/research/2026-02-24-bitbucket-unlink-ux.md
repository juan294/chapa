# Research: Bitbucket Unlink UX Patterns

> Date: 2026-02-24
> Scope: Current Chapa implementation + competitive analysis of 11 services
> Purpose: Document how the Bitbucket "Unlink" action is implemented today, and how comparable services handle platform linking/unlinking UX.

---

## 1. Current Implementation in Chapa

### Component: UserMenu.tsx

**File:** `apps/web/components/UserMenu.tsx`

The Bitbucket section lives inside the dropdown menu at **lines 164–191**. When a Bitbucket account is linked, the UI renders:

1. A `<div>` container with `px-3 py-2` padding (line 166)
2. A row showing the Bitbucket SVG icon (16x16) + the remote username in `text-text-primary` (lines 167–171)
3. Below that, a standalone `<button>` labeled "Unlink" styled as `mt-1 text-xs text-terminal-red hover:underline` (lines 173–178)

When not linked, a single anchor tag `<a href="/api/auth/bitbucket/connect">` renders "Link Bitbucket" with the same Bitbucket icon, styled consistently with other menu items (`rounded-xl px-3 py-2.5 text-sm text-text-secondary`) at lines 181–189.

### Visual structure (linked state)

```
┌─────────────────────────┐
│  [avatar] Juan Gonzalez  │
│  @juan294                │
│─────────────────────────│
│  [GH icon] Your Badge   │  ← menu item (link)
│  [BB icon] juan294       │  ← static text, not a link
│  Unlink                  │  ← red text button, below the BB row
│─────────────────────────│
│  ...                     │
└─────────────────────────┘
```

### Key observations about current implementation

- The "Unlink" button is a bare `<button>` with no `role="menuitem"`, unlike other items in the dropdown (line 173).
- The linked Bitbucket row is a `<div>`, not a link/button — it's display-only (line 166).
- The "Unlink" button sits below the Bitbucket row with `mt-1` spacing, making it feel disconnected from the row above.
- It uses `text-xs` (12px), smaller than every other menu item which uses `text-sm` (14px).
- No confirmation dialog — clicking "Unlink" immediately fires `handleUnlinkBitbucket()` (line 36), which POSTs to `/api/auth/bitbucket/disconnect` and silently updates state.
- The disconnect handler has graceful failure (`catch {}`) but no user feedback on error (lines 42–44).

### Handler and API

- **Handler** (`handleUnlinkBitbucket`, lines 36–45): POSTs to `/api/auth/bitbucket/disconnect`, then sets `bbStatus` to `{ linked: false, remoteLogin: null }` on success.
- **Disconnect endpoint** (`apps/web/app/api/auth/bitbucket/disconnect/route.ts`): Requires session auth, calls `dbDeleteLinkedPlatform()`, clears two cache keys (`stats:v2:merged:*`, `stats:v2:bitbucket:*`).
- **Status endpoint** (`apps/web/app/api/auth/bitbucket/status/route.ts`): Returns `{ enabled, linked, remoteLogin, connectedAt }`.

---

## 2. Competitive Analysis: 11 Services

### Vercel

- **Location:** Account Settings > Authentication page (dedicated settings page, not dropdown).
- **Action:** Each Git provider shown as a row/card with connect/disconnect. Text-based action.
- **Confirmation:** Gated behind the settings page (natural friction from navigation depth).
- **Pattern:** Separates "login connections" (account-level) from "Git integrations" (project-level).

### Netlify

- **Location:** User Settings > General > Profile > Connected accounts.
- **Action:** Inline three-action model per provider: Add, Edit, Disconnect. Text-based.
- **Confirmation:** Not explicit dialog; the deep settings path provides friction.
- **Pattern:** One provider per account; cannot connect two Netlify users to the same Git account.

### Linear

- **Location:** Settings > Features > Integrations, with sub-pages per integration.
- **Action:** Disconnect available in the integration sub-page. Text-based.
- **Confirmation:** Yes — dedicated confirmation dialog (explicitly improved in their changelog).
- **Pattern:** Admin-only control for workspace integrations. Each integration has its own page.

### Notion

- **Location:** Settings & Members > My connections / Integrations tab.
- **Action:** **Three-dot overflow menu** next to each integration. "Disconnect [name]" shown in **red text** inside the menu.
- **Confirmation:** Two-step: (1) red "Disconnect" in overflow menu, (2) confirmation popup with **red "Disconnect" button**.
- **Pattern:** The most polished pattern observed. Red text signals destructiveness clearly.

### Figma

- **Location:** Settings > Community (profile connections) / Settings > Security (API tokens).
- **Action:** "Remove" for profile connections (single-click). "Revoke access" for tokens.
- **Confirmation:** None for profile connections. Per-token action for revocation.
- **Pattern:** Separates profile connections from integration access. Different actions for different stakes.

### WakaTime

- **Location:** Settings page for cloud integrations; per-editor plugin settings for IDE integrations.
- **Action:** Disconnect from settings page. Card-based integration catalog.
- **Confirmation:** Implied (documentation notes that disconnecting deletes associated data).
- **Pattern:** Split management: web settings for cloud, editor preferences for IDE plugins.

### GitKraken

- **Location:** Preferences > Integrations > [Provider] (desktop app panel).
- **Action:** Disconnect button in the provider's preferences sub-section.
- **Confirmation:** Not explicitly documented; direct action in preferences.
- **Pattern:** Profile-based integration management — each GitKraken profile has its own connections.

### Raycast

- **Location:** Preferences > Extensions > [Extension] (per-extension panel).
- **Action:** "Log out" button in the extension's preferences panel. Some use API token text fields.
- **Confirmation:** Varies by extension; mostly direct action.
- **Pattern:** Fully decentralized — no central "connected accounts" page. Each extension owns its auth.

### 1Password

- **Location:** Manage Accounts interface (account switcher > Manage Accounts).
- **Action:** Three-dot menu > "Sign Out" or web-based "Unlink Account" button.
- **Confirmation:** Tiered. Simple sign-out for temporary disconnect. **Type "Unlink Account"** for permanent unlinking (highest friction observed in this research).
- **Pattern:** Confirmation severity matches action severity. Uses "Unlink" terminology.

### GitHub (own platform)

- **Location:** Settings > Applications > Authorized OAuth Apps / Authorized GitHub Apps.
- **Action:** Three-dot menu > "Revoke". Bulk "Revoke all" also available.
- **Confirmation:** Yes — warning message about consequences.
- **Pattern:** Three-dot menu for per-item actions, consistent with Notion/1Password.

### Loom (Atlassian)

- **Location:** Account Settings > Connected Accounts.
- **Action:** **X button** (icon-only) next to each connected account.
- **Confirmation:** Minimal — X button acts directly. Page refresh needed to see final state.
- **Pattern:** The only service using icon-only disconnect. Noted as the least robust pattern (no feedback, requires refresh).

---

## 3. Cross-Cutting Patterns

### Where the unlink/disconnect action lives

| Pattern | Services | Count |
|---------|----------|-------|
| Dedicated settings page | Vercel, Netlify, Linear, Notion, Figma, WakaTime, GitKraken, 1Password | 8 |
| Three-dot overflow menu | Notion, GitHub, 1Password | 3 |
| Direct inline text button/link | Netlify, Loom, Vercel | 3 |
| Per-extension preferences | Raycast | 1 |
| Dropdown menu | **Chapa (current)** | 1 |

No other service studied places the unlink action directly inside a user menu dropdown.

### Action element styling

| Style | Services | Notes |
|-------|----------|-------|
| Text link/button | Vercel, Netlify, Linear, WakaTime, GitKraken | Most common |
| Red text in overflow menu | Notion | Destructive signal in three-dot menu |
| Red confirmation button | Notion, Linear | In confirmation dialog |
| Icon-only (X) | Loom | Only one service; noted as weakest pattern |
| Type-to-confirm | 1Password | Highest-stakes scenario only |

### Terminology

| Term | Services using it | Count |
|------|-------------------|-------|
| Disconnect | Notion, Netlify, Linear, WakaTime, GitKraken | 5 |
| Revoke | GitHub, Figma (tokens) | 2 |
| Remove | Figma (connections), 1Password | 2 |
| Unlink | 1Password, **Chapa** | 2 |
| Log out / Sign out | Raycast, 1Password | 2 |

### Confirmation patterns

| Level | Pattern | Services |
|-------|---------|----------|
| None | Direct single-click action | Figma (connections), Raycast, Loom, **Chapa (current)** |
| Light | Confirmation dialog + button | Notion, Linear |
| Moderate | Warning message + confirm button | GitHub |
| Heavy | Type exact phrase | 1Password |

---

## 4. Design Reference: Notion's Three-Dot Pattern

The Notion pattern was the most polished among all services studied:

1. Each integration row shows: **[icon] Integration Name [status] [...] (three-dot button)**
2. Clicking the three-dot button opens a small overflow menu with options:
   - Visit developer website
   - Contact support
   - **Disconnect [Integration Name]** (in red text)
3. Clicking the red "Disconnect" option opens a **confirmation popup** with:
   - Explanation of what will happen
   - Cancel button (default focus)
   - **Red "Disconnect" button** to confirm

This pattern provides: (a) discoverability without visual clutter, (b) clear destructive signaling via red text, (c) protection against accidental clicks via confirmation.

---

## 5. Design Reference: Inline Row Pattern (Netlify/Vercel)

A simpler alternative used by Netlify and Vercel:

1. Each connected account is a settings row: **[icon] Provider Name — @username [Disconnect]**
2. "Disconnect" is a text link/button at the end of the row, right-aligned.
3. The row itself may include additional info (connected date, permissions).
4. Navigation depth (Settings > Profile > Connected Accounts) provides natural friction.

This pattern works when the action lives in a settings page, not a dropdown.

---

## Sources

- [Vercel Account Management](https://vercel.com/docs/accounts)
- [Vercel Git Integration Settings](https://vercel.com/blog/new-git-integration-settings)
- [Netlify User Settings](https://docs.netlify.com/manage/accounts-and-billing/user-settings/)
- [Linear Slack Integration](https://linear.app/docs/slack)
- [Notion Disconnect Guide](https://www.simple.ink/guides/how-to-disconnect-notion-integrations)
- [Notion Link Previews](https://www.notion.com/help/link-previews)
- [Figma Profile Connections](https://help.figma.com/hc/en-us/articles/4404285788183-Add-or-remove-profile-connections)
- [WakaTime Integrations](https://wakatime.com/integrations)
- [GitKraken GitHub Integration](https://help.gitkraken.com/gitkraken-desktop/github-gitkraken-desktop/)
- [Raycast Preferences](https://manual.raycast.com/preferences)
- [1Password Multiple Accounts](https://support.1password.com/multiple-accounts/)
- [1Password Unlink Account](https://services.gvsu.edu/TDClient/60/Portal/KB/ArticleDet?ID=13851)
- [GitHub Authorized OAuth Apps](https://docs.github.com/en/apps/oauth-apps/using-oauth-apps/reviewing-your-authorized-oauth-apps)
- [Loom Connected Accounts](https://support.atlassian.com/loom/docs/connected-accounts-google-auth-slack-and-apple/)
- [NN/g Confirmation Dialogs](https://www.nngroup.com/articles/confirmation-dialog/)
