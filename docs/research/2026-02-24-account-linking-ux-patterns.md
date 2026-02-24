# Account Linking/Unlinking UX Patterns Research

> Date: 2026-02-24
> Purpose: Inform the design of Chapa's Bitbucket link/unlink UX by studying real-world patterns from popular developer tools.

---

## Executive Summary

After researching 9 developer tools and services, clear patterns emerge for how the industry handles linked third-party accounts:

1. **Location**: Most services use a dedicated settings page (not a dropdown menu) as the primary location for managing connected accounts. Dropdown menus show connection *status* but rarely host the unlink action.
2. **Unlink action style**: The dominant pattern is a text link or small button (not an icon-only action). Red/destructive coloring is common for the disconnect action.
3. **Confirmation**: Nearly all services require a confirmation step for disconnection. The severity of the confirmation scales with the destructiveness of the action.
4. **Three-dot menus**: Services with multiple integrations (Notion, GitHub) use overflow menus (three-dot / ellipsis) to house the disconnect action alongside other options.
5. **Terminology**: "Disconnect" is the most common verb, followed by "Revoke," "Remove," and "Unlink." "Disconnect" is the safest, most neutral choice.

---

## Service-by-Service Analysis

### 1. Vercel

**Where linked accounts appear:**
- **Account Settings > Authentication page** (primary). This is a dedicated settings page, not a dropdown.
- Shows all login connections: GitHub, GitLab, Bitbucket, passkeys, email.
- Each Git provider is shown as a row/card with the provider name, connected account username, and connection status.
- A separate **Project Settings > Git** section manages per-project repository connections.

**Unlink/disconnect action:**
- At the account level: the Authentication page shows connected providers with the ability to disconnect.
- At the project level: a "Disconnect" option is available in the Git section of Project Settings to detach a specific repository.
- The account-level page uses a clean card layout where each provider shows its connection status and has an action to connect or disconnect.

**Confirmation:** Yes, disconnecting a Git provider from your account is a significant action (affects all projects), so Vercel gates it behind the settings page (not a quick-action menu).

**Notable patterns:**
- Vercel separates "login connections" (account-level auth) from "Git integrations" (project-level repo linking). This two-level model is relevant for Chapa if we ever link Bitbucket at both the user and project level.
- Hobby accounts are limited to one login connection per Git provider.
- The Git Integrations settings page was redesigned in 2023 to clearly show connection status and how to edit it.

**Sources:**
- [Account Management](https://vercel.com/docs/accounts)
- [New Git Integration Settings](https://vercel.com/blog/new-git-integration-settings)
- [Git Settings](https://vercel.com/docs/project-configuration/git-settings)

---

### 2. Netlify

**Where linked accounts appear:**
- **User Settings > General > Profile > Connected accounts** section.
- Shows each connected Git provider (GitHub, GitLab, Bitbucket) with the connected account info.
- Connected accounts also appear in member lists at the site and team level.

**Unlink/disconnect action:**
- Available directly in the Connected accounts section: users can **add**, **edit**, and **disconnect** Git provider accounts.
- The disconnect action appears inline in the settings row for each provider.

**Confirmation:** Not explicitly documented, but the action lives deep in settings (User Settings > General > Profile) which provides natural friction.

**Notable patterns:**
- Users who signed up via a Git provider have that provider pre-linked automatically.
- Cannot connect two different Netlify users to the same Git provider account.
- Cannot connect one Netlify user to more than one account from the same Git provider.
- Simple three-action model per provider: Add, Edit, Disconnect.

**Sources:**
- [User Settings](https://docs.netlify.com/manage/accounts-and-billing/user-settings/)
- [Repository Permissions](https://docs.netlify.com/build/git-workflows/repo-permissions-linking/)

---

### 3. Linear

**Where linked accounts appear:**
- **Settings > Features > Integrations** page (workspace-level).
- Each integration (GitHub, Slack, Figma, etc.) has its own sub-page within the integrations settings.
- Personal account preferences for Git automations are separate from workspace-level integration settings.

**Unlink/disconnect action:**
- Workspace admins can disconnect integrations from the integration's settings sub-page within Linear.
- The Slack integration, for example, shows connected workspaces with a **plus (+) button** to add more (Enterprise). The disconnect action exists but is not prominently surfaced.
- Linear improved the confirmation dialog specifically for integration disconnection (noted in their changelog for the Intercom integration).

**Confirmation:** Yes. Linear explicitly improved confirmation dialogs before disconnecting integrations, confirming they use confirmation modals.

**Notable patterns:**
- Admin-only control for workspace integrations. Regular members cannot disconnect integrations.
- Each integration gets its own settings sub-page rather than being a row in a flat list.
- The changelog mentions fixing the flow where disconnecting and reconnecting updates the "enablement date" correctly, showing they take the disconnect/reconnect cycle seriously.

**Sources:**
- [Linear Slack Integration](https://linear.app/docs/slack)
- [Linear Changelog](https://linear.app/changelog)
- [Linear Integrations](https://linear.app/integrations/automations)

---

### 4. Notion

**Where linked accounts appear:**
- **Settings & Members > My connections** for personal integration connections.
- **Settings & Members > Integrations** tab for workspace-level integrations.
- When pasting a link from a supported platform (GitHub, Slack, etc.), Notion shows an inline "Connect" button if not yet connected.

**Unlink/disconnect action:**
- **Three-dot menu (ellipsis)** next to each integration in the Integrations tab.
- Clicking the three-dot icon reveals a dropdown with:
  - Visit developer website
  - Contact support
  - **"Disconnect [integration name]"** (displayed in **red text**)
- After clicking the red disconnect option, a **confirmation popup** appears with a **red "Disconnect" button** to confirm.
- For workspace-level connections: the three-dot menu next to GitHub shows **"Disconnect all users"**.

**Confirmation:** Yes. Two-step process: (1) click red "Disconnect" in the overflow menu, (2) confirm with a red "Disconnect" button in the popup.

**Notable patterns:**
- Red text for the destructive action in the overflow menu is a strong visual signal.
- The confirmation dialog uses a red button, reinforcing the destructive nature.
- Users can connect multiple accounts for the same integration via "Connect another account."
- Notion recommends also revoking the integration on the external platform itself (GitHub, Slack, etc.) after disconnecting in Notion.
- Inline "Connect" prompts appear contextually when pasting links from unsupported providers.

**Sources:**
- [How to Disconnect Notion Integrations](https://www.simple.ink/guides/how-to-disconnect-notion-integrations)
- [Notion Link Previews](https://www.notion.com/help/link-previews)
- [Add & Manage Connections](https://www.notion.com/help/add-and-manage-connections-with-the-api)

---

### 5. Figma

**Where linked accounts appear:**
- **Settings > Community** tab for profile connections (linking multiple Figma accounts to one Community profile).
- **Settings > Security** tab for personal access tokens (third-party integrations).
- **Admin > Settings > AI > Connectors** for Figma Make connectors (workspace-level).

**Unlink/disconnect action:**
- Profile connections: a **remove action** next to each connected account in the Profile connections section. Click to disconnect; no explicit confirmation dialog is mentioned.
- API tokens: a **"Revoke access"** action next to each personal access token in the Security tab. This revokes the third-party integration's ability to access data.

**Confirmation:** For profile connections, the removal appears to be a single-click action without a confirmation dialog. For token revocation, the action is listed per-token with a clear "Revoke access" label.

**Notable patterns:**
- Figma separates "profile connections" (linking Figma accounts together) from "integration access" (API tokens). Different disconnection models for different concerns.
- Merging Community profiles is explicitly called out as irreversible, but removing a connection is not (simpler undo model).
- The Account switcher menu (top-left) is the entry point to settings, not a dropdown with inline disconnect actions.

**Sources:**
- [Add or Remove Profile Connections](https://help.figma.com/hc/en-us/articles/4404285788183-Add-or-remove-profile-connections)
- [View and Manage Account Settings](https://help.figma.com/hc/en-us/articles/1500006061462-View-and-manage-account-settings)
- [Manage Personal Access Tokens](https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens)

---

### 6. WakaTime

**Where linked accounts appear:**
- **Integrations page** (wakatime.com/integrations) shows all available integrations as cards with app logos, names, and descriptions.
- **Settings page** (account settings) manages connected integrations.
- Individual IDE plugins are managed within each editor's plugin settings.

**Unlink/disconnect action:**
- From the settings page, users can remove/disconnect integrations. External durations for an integration are deleted when the user disconnects.
- For GitHub specifically, there is an "Adjust GitHub permissions" link on the GitHub integration settings page.
- IDE plugins: uninstalled from within each editor (e.g., VS Code: settings icon > Uninstall; JetBrains: Preferences > Plugins > Uninstall).

**Confirmation:** Not explicitly documented for the web settings page. The documentation emphasizes that disconnecting deletes associated data (external durations), which implies a confirmation step.

**Notable patterns:**
- Card-based layout for the integrations catalog.
- Integration management is split between the web settings page (for cloud integrations like GitHub, Slack) and individual editor plugin settings (for IDE integrations).
- Data deletion on disconnect is explicitly documented as a consequence.

**Sources:**
- [WakaTime Integrations](https://wakatime.com/integrations)
- [WakaTime FAQ](https://wakatime.com/faq)
- [GitHub Permissions Update](https://wakatime.com/blog/64-github-permissions-update)

---

### 7. GitKraken

**Where linked accounts appear:**
- **Preferences > Integrations** panel. Each provider (GitHub, GitLab, Bitbucket, Azure DevOps) has its own sub-section.
- The currently connected account is shown with its username.
- Profile-based: each GitKraken profile can have different integration connections.

**Unlink/disconnect action:**
- Navigate to **Preferences > Integrations > [Provider]** and click to disconnect the current account.
- A "Connect to GitHub" button replaces the connected state after disconnection.
- To switch accounts: disconnect the current one, sign into the desired account in your browser, then reconnect.

**Confirmation:** Not explicitly documented. The disconnect appears to be a direct action in the Preferences panel.

**Notable patterns:**
- **Profile-based integration management** is unique among the services researched. Each profile has its own integration connections, so switching between multiple GitHub accounts means switching profiles, not disconnecting/reconnecting.
- One account per provider per profile.
- The connection flow uses the browser for OAuth (opens browser > authenticate > "Open GitKraken" button to return).
- Manual token entry is available as an alternative to OAuth.

**Sources:**
- [GitHub Integration](https://help.gitkraken.com/gitkraken-desktop/github-gitkraken-desktop/)
- [Managing Multiple GitHub Accounts](https://www.gitkraken.com/blog/managing-mulitple-github-accounts)
- [GitKraken Profiles](https://help.gitkraken.com/gitkraken-desktop/profiles/)

---

### 8. Raycast

**Where linked accounts appear:**
- **Raycast Preferences > Extensions** tab. Each extension manages its own authentication.
- There is no centralized "Connected Accounts" page. Authentication is decentralized to individual extensions.
- When an extension requires authentication, it prompts the user during first use.

**Unlink/disconnect action:**
- Per-extension: Select the extension in Preferences > Extensions, then click **"Log out"** in the right panel.
- Example: Google Workspace extension has a "Log out" button in the extension's preferences panel.
- Some extensions store API tokens as preferences (text fields), so "disconnecting" means clearing the token field.

**Confirmation:** Varies by extension. The "Log out" button appears to be a direct action without a confirmation dialog for most extensions.

**Notable patterns:**
- **Decentralized authentication model** -- no central "connected accounts" list. Each extension owns its own auth state.
- The extension preferences panel on the right side of the Preferences window shows per-extension settings including auth actions.
- Cloud Sync (Raycast Pro) syncs extension preferences across devices, including auth state.
- Required preferences must be set before a command opens, ensuring proper setup.

**Sources:**
- [Raycast Preferences](https://manual.raycast.com/preferences)
- [Raycast Preferences API](https://developers.raycast.com/api-reference/preferences)
- [Cloud Sync](https://manual.raycast.com/cloud-sync)

---

### 9. 1Password

**Where linked accounts appear:**
- **Account switcher** (top-left of sidebar or accounts screen) shows all added accounts.
- **Manage Accounts** interface (accessed via account switcher icon > "Manage Accounts") shows all linked accounts.
- On 1Password.com: **Profile menu (top-right) > Manage Account** for web-based management of linked accounts.

**Unlink/disconnect action:**
- Desktop app: from the Manage Accounts interface, click an account > **ellipsis menu (three dots) > Sign Out**.
- Web: navigate to Manage Account, find the linked account section, click **"Unlink Account"** button.
- Mobile: tap and hold on an account > **"Remove Account from List"**.
- Right-click context menu on desktop also offers "Remove account from list."

**Confirmation:** Yes, and notably strict. To unlink a managed account (e.g., employer-linked family account), the user must **type the exact phrase "Unlink Account"** to confirm. This is the strongest confirmation pattern observed in this research.

**Notable patterns:**
- **Multiple confirmation tiers**: simple "Sign Out" for temporary disconnection vs. typing "Unlink Account" for permanent unlinking. The severity of confirmation matches the severity of the action.
- Signing out of all accounts removes app settings entirely.
- Linked family accounts (employer-provided) have automatic unlinking when employment ends.
- The three-dot ellipsis menu pattern is used for account actions, similar to Notion.

**Sources:**
- [How to Use Multiple Accounts](https://support.1password.com/multiple-accounts/)
- [1Password Link/Unlink Account](https://services.gvsu.edu/TDClient/60/Portal/KB/ArticleDet?ID=13851)
- [Sign Out of 1Password](https://support.1password.com/sign-out/)

---

## Bonus: GitHub's Own Pattern

**Where authorized apps appear:**
- **Settings > Applications > Authorized OAuth Apps** tab and **Authorized GitHub Apps** tab.

**Unlink/disconnect action:**
- **Three-dot menu** next to each authorized app > **"Revoke"** action.
- A **"Revoke all"** bulk action is also available.
- The revoke action shows a message explaining the consequences.

**Confirmation:** Yes. The interface warns that revoking cannot be undone.

**Sources:**
- [Reviewing Authorized OAuth Apps](https://docs.github.com/en/apps/oauth-apps/using-oauth-apps/reviewing-your-authorized-oauth-apps)
- [Reviewing and Revoking GitHub Apps](https://docs.github.com/en/apps/using-github-apps/reviewing-and-revoking-authorization-of-github-apps)

---

## Bonus: Loom (Atlassian)

**Where linked accounts appear:**
- **Account Settings > Connected Accounts** section.
- Shows connected email (e.g., Google, Slack, Apple) with the account email visible.

**Unlink/disconnect action:**
- **X button** next to the connected account. Simple, direct, minimal.
- After disconnecting, the UI reverts to showing a "Connect with [Provider]" button.
- Google OAuth disconnect requires adding a password first (safety gate).

**Confirmation:** Minimal. The X button acts directly; the page must be refreshed to see the final state.

**Sources:**
- [Loom Connected Accounts](https://support.atlassian.com/loom/docs/connected-accounts-google-auth-slack-and-apple/)

---

## Cross-Cutting Patterns Summary

### Where the Unlink Action Lives

| Pattern | Services Using It | Description |
|---------|-------------------|-------------|
| **Dedicated settings page** | Vercel, Netlify, Linear, Notion, Figma, WakaTime, GitKraken, 1Password | Primary location is a settings/preferences page, not a dropdown |
| **Per-item overflow menu** | Notion, GitHub, 1Password | Three-dot (ellipsis) menu next to each connected item |
| **Direct inline button** | Netlify, Loom | Button/link directly visible in the settings row |
| **Per-extension settings** | Raycast | Decentralized; each integration manages its own auth |
| **Profile-based** | GitKraken | Integrations tied to profiles, not a global list |

### Disconnect Action Styling

| Style | Services | Notes |
|-------|----------|-------|
| **Red text in menu** | Notion | "Disconnect [name]" in red within three-dot dropdown |
| **Red confirmation button** | Notion | Red "Disconnect" button in confirmation popup |
| **Text link / button** | Vercel, Netlify, Linear | Standard text button, not icon-only |
| **"Revoke" text** | GitHub, Figma (tokens) | Used for OAuth/API token revocation |
| **X icon** | Loom | Minimal icon-only approach |
| **"Log out" button** | Raycast | Used within per-extension preferences |
| **Type-to-confirm** | 1Password | Must type "Unlink Account" for high-stakes disconnection |

### Confirmation Patterns

| Level | Pattern | When Used |
|-------|---------|-----------|
| **None** | Direct action, single click | Low-stakes: Figma profile connections, Raycast extension logout |
| **Light** | Confirmation dialog with button | Medium-stakes: Notion integrations, Linear integrations |
| **Moderate** | Warning message + confirm button | Medium-high: GitHub OAuth revocation |
| **Heavy** | Type exact phrase to confirm | High-stakes: 1Password account unlinking |

### Terminology Frequency

| Term | Services Using It |
|------|-------------------|
| **Disconnect** | Notion, Netlify, Linear, WakaTime, GitKraken |
| **Revoke** | GitHub, Figma (tokens), WakaTime (API) |
| **Remove** | Figma (profile connections), 1Password |
| **Unlink** | 1Password |
| **Log out / Sign out** | Raycast, 1Password |

---

## Recommendations for Chapa

Based on these patterns, here are recommendations for Chapa's Bitbucket link/unlink UX:

### 1. Primary location: User Menu (dropdown) for status + Settings for management

- **In the dropdown menu**: Show the connected Bitbucket account as a read-only status indicator (platform icon + username). This follows the Vercel/Netlify pattern of showing connection status in accessible locations.
- **For the unlink action**: Include a small "Unlink" text link in the dropdown (following the Notion pattern of making the action accessible but not prominent). Alternatively, place it only in a dedicated settings area if/when we build one.

### 2. Terminology: "Unlink"

- "Unlink" is the most appropriate term for Chapa's use case because we are linking/unlinking a supplemental data source, not fully disconnecting an OAuth session or revoking API access. "Disconnect" implies a stronger severing of connection. "Unlink" matches 1Password's terminology for removing an associated account.
- Action label: **"Unlink Bitbucket"** (verb + platform name, like Notion's "Disconnect [name]").

### 3. Confirmation: Light confirmation dialog

- A simple confirmation dialog with: explanation of what unlinking does ("Your Bitbucket stats will no longer be included in your impact score"), a cancel button, and a confirm button.
- The confirm button should be styled as destructive (red or outlined) following the Notion pattern.
- No need for type-to-confirm (1Password's pattern is for enterprise account management, much higher stakes than Chapa's use case).

### 4. Visual treatment in dropdown

- Connected state: `[Bitbucket icon] Bitbucket: @username` with a small "Unlink" text link or an X icon.
- Not connected state: `[Bitbucket icon] Link Bitbucket` as a clickable action.
- Follow the Loom pattern of the UI reverting to a "Connect" state after unlinking.

### 5. Avoid icon-only disconnect

- All services except Loom avoid icon-only disconnect actions. Text labels ("Disconnect", "Revoke", "Unlink") are the norm because the action needs to be unambiguous. An icon-only X could be confused with "close" or "dismiss."
