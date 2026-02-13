# Badge Embed Testing Guide

Your badge URL:
```
https://chapa.thecreativetoken.com/u/juan294/badge.svg
```

Your share page URL (for link previews):
```
https://chapa.thecreativetoken.com/u/juan294
```

---

## Platform Compatibility Matrix

Stars indicate where the badge **shines** — full SVG with animations rendered natively.

| # | Platform | Embed Method | Animated SVG? | Priority |
|---|----------|-------------|---------------|----------|
| 1 | GitHub Profile README | Markdown image | Yes | High |
| 2 | GitHub Repo README | Markdown image | Yes | High |
| 3 | GitHub Issues / PRs / Discussions | Markdown image | Yes | High |
| 4 | GitLab Project README | Markdown image | Yes | High |
| 5 | GitLab Profile README | Markdown image | Yes | High |
| 6 | Dev.to | HTML in post body | Yes | High |
| 7 | Hashnode | HTML in post body | Yes | High |
| 8 | Codeberg README | Markdown image | Yes | High |
| 9 | Personal Website / Portfolio | HTML | Yes | High |
| 10 | Bitbucket README | Markdown image | Partial | Medium |
| 11 | Observable Notebooks | HTML | Yes | Medium |
| 12 | Notion | Embed block (URL) | No (renders static) | Medium |
| 13 | Reddit (post / comment) | Link or upload PNG | No | Medium |
| 14 | Stack Overflow (profile About) | Markdown image | No (static) | Medium |
| 15 | npm package page | Markdown in package README | Yes | Medium |
| 16 | CodeSandbox / StackBlitz README | Markdown image | Yes | Medium |
| 17 | Medium | Upload PNG only | No | Low |
| 18 | LinkedIn Post | Share link (OG card) | No | Low |
| 19 | LinkedIn Article | Upload PNG | No | Low |
| 20 | X / Twitter | Share link (OG card) | No | Low |
| 21 | Discord message | Link preview (OG card) | No | Low |
| 22 | Slack message | Link preview (unfurl) | No | Low |
| 23 | Hacker News | Link only (no images) | No | Low |
| 24 | Product Hunt | Upload PNG | No | Low |
| 25 | Mastodon | Share link (OG card) | No | Low |
| 26 | Bluesky | Share link (OG card) | No | Low |

---

## Ready-to-Copy Snippets

### 1. GitHub Profile README

Create or edit `github.com/juan294/juan294/README.md`:

```markdown
[![Chapa Impact Badge](https://chapa.thecreativetoken.com/u/juan294/badge.svg)](https://chapa.thecreativetoken.com/u/juan294)
```

---

### 2. GitHub Repo README

Same as profile README — paste anywhere in the `.md` file:

```markdown
[![Chapa Impact Badge](https://chapa.thecreativetoken.com/u/juan294/badge.svg)](https://chapa.thecreativetoken.com/u/juan294)
```

---

### 3. GitHub Issues / PRs / Discussions

Paste in any comment box:

```markdown
[![Chapa Impact Badge](https://chapa.thecreativetoken.com/u/juan294/badge.svg)](https://chapa.thecreativetoken.com/u/juan294)
```

---

### 4. GitLab Project README

Same markdown syntax — edit the project `README.md`:

```markdown
[![Chapa Impact Badge](https://chapa.thecreativetoken.com/u/juan294/badge.svg)](https://chapa.thecreativetoken.com/u/juan294)
```

---

### 5. GitLab Profile README

Create a project named after your GitLab username, add a `README.md`:

```markdown
[![Chapa Impact Badge](https://chapa.thecreativetoken.com/u/juan294/badge.svg)](https://chapa.thecreativetoken.com/u/juan294)
```

---

### 6. Dev.to

Use HTML in the post editor (switch to "basic markdown" mode):

```html
<a href="https://chapa.thecreativetoken.com/u/juan294">
  <img src="https://chapa.thecreativetoken.com/u/juan294/badge.svg" alt="Chapa Impact Badge" width="100%" />
</a>
```

---

### 7. Hashnode

Use HTML block or markdown in the post editor:

```html
<a href="https://chapa.thecreativetoken.com/u/juan294">
  <img src="https://chapa.thecreativetoken.com/u/juan294/badge.svg" alt="Chapa Impact Badge" width="100%" />
</a>
```

---

### 8. Codeberg README

Same markdown syntax as GitHub:

```markdown
[![Chapa Impact Badge](https://chapa.thecreativetoken.com/u/juan294/badge.svg)](https://chapa.thecreativetoken.com/u/juan294)
```

---

### 9. Personal Website / Portfolio

Full HTML with responsive sizing:

```html
<a href="https://chapa.thecreativetoken.com/u/juan294" target="_blank" rel="noopener">
  <img src="https://chapa.thecreativetoken.com/u/juan294/badge.svg" alt="Chapa Impact Badge" style="width:100%;max-width:800px;" />
</a>
```

---

### 10. Bitbucket README

Markdown image (Bitbucket may not animate CSS in SVG):

```markdown
[![Chapa Impact Badge](https://chapa.thecreativetoken.com/u/juan294/badge.svg)](https://chapa.thecreativetoken.com/u/juan294)
```

---

### 11. Observable Notebooks

Use HTML cell:

```html
html`<a href="https://chapa.thecreativetoken.com/u/juan294">
  <img src="https://chapa.thecreativetoken.com/u/juan294/badge.svg" alt="Chapa Impact Badge" width="100%" />
</a>`
```

---

### 12. Notion

1. Type `/embed`
2. Paste: `https://chapa.thecreativetoken.com/u/juan294/badge.svg`
3. Resize the embed block as needed

Note: Notion renders SVGs statically — no CSS animations.

---

### 13. Reddit

Upload a PNG screenshot of the badge, or paste the share link:

```
https://chapa.thecreativetoken.com/u/juan294
```

---

### 14. Stack Overflow Profile

Edit your profile "About me" section (supports limited markdown):

```markdown
[![Chapa Impact Badge](https://chapa.thecreativetoken.com/u/juan294/badge.svg)](https://chapa.thecreativetoken.com/u/juan294)
```

Note: Stack Overflow sanitizes SVG — animations won't play. The badge renders as a static image.

---

### 15. npm Package README

If you publish a package, add to the README:

```markdown
[![Chapa Impact Badge](https://chapa.thecreativetoken.com/u/juan294/badge.svg)](https://chapa.thecreativetoken.com/u/juan294)
```

npmjs.com renders SVGs with animations from external URLs.

---

### 16. CodeSandbox / StackBlitz README

Same markdown syntax in the project README:

```markdown
[![Chapa Impact Badge](https://chapa.thecreativetoken.com/u/juan294/badge.svg)](https://chapa.thecreativetoken.com/u/juan294)
```

---

### 17. Medium

Medium strips external `<img>` tags. You must:

1. Open `https://chapa.thecreativetoken.com/u/juan294/badge.svg` in your browser
2. Take a screenshot or save as PNG
3. Upload the image in the Medium editor
4. Add a link to `https://chapa.thecreativetoken.com/u/juan294` on the image

---

### 18. LinkedIn Post

Share the link — LinkedIn will pull OG meta tags for a rich preview card:

```
Check out my developer impact badge on Chapa:
https://chapa.thecreativetoken.com/u/juan294
```

---

### 19. LinkedIn Article

Upload a PNG screenshot. In the LinkedIn article editor:

1. Click the image icon
2. Upload your badge screenshot
3. Link the image to `https://chapa.thecreativetoken.com/u/juan294`

---

### 20. X / Twitter

Share the link — X will show OG card preview:

```
Check out my developer impact badge ⚡
https://chapa.thecreativetoken.com/u/juan294
```

---

### 21. Discord

Paste the link — Discord auto-unfurls with OG tags:

```
https://chapa.thecreativetoken.com/u/juan294
```

For direct image embed in a bot or webhook:

```markdown
![Chapa Badge](https://chapa.thecreativetoken.com/u/juan294/badge.svg)
```

---

### 22. Slack

Paste the link — Slack will unfurl with OG preview:

```
https://chapa.thecreativetoken.com/u/juan294
```

---

### 23. Hacker News

Link only — no images supported. Use in a Show HN or comment:

```
https://chapa.thecreativetoken.com/u/juan294
```

---

### 24. Product Hunt

Upload a PNG screenshot as a gallery image or in a discussion post.

---

### 25. Mastodon

Paste the share page link — Mastodon pulls OG tags:

```
https://chapa.thecreativetoken.com/u/juan294
```

---

### 26. Bluesky

Paste the share page link — Bluesky pulls OG tags:

```
https://chapa.thecreativetoken.com/u/juan294
```

---

## Testing Checklist

Start with the **High priority** platforms (animated SVG renders natively):

- [ ] GitHub Profile README (`juan294/juan294`)
- [ ] GitHub Repo README (any repo)
- [ ] GitHub Issue / PR comment
- [ ] GitLab Project README
- [ ] Dev.to post
- [ ] Hashnode post
- [ ] Codeberg README
- [ ] Personal website

Then **Medium priority** (static render or partial support):

- [ ] npm package README
- [ ] Notion embed
- [ ] Stack Overflow profile
- [ ] Reddit post
- [ ] CodeSandbox / StackBlitz README
- [ ] Bitbucket README
- [ ] Observable Notebook

Then **Low priority** (link preview / upload PNG):

- [ ] LinkedIn post (link card)
- [ ] LinkedIn article (PNG upload)
- [ ] X / Twitter (link card)
- [ ] Medium (PNG upload)
- [ ] Discord (link unfurl)
- [ ] Slack (link unfurl)
- [ ] Mastodon (link card)
- [ ] Bluesky (link card)
- [ ] Hacker News (link only)
- [ ] Product Hunt (PNG upload)
