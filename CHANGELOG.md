# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-16

### Added
- Impact v4 scoring engine with 4 dimensions (Building, Guarding, Consistency, Breadth)
- Developer archetype classification (Builder, Guardian, Marathoner, Polymath, Balanced, Emerging)
- Embeddable SVG badge at `/u/:handle/badge.svg` with heatmap, radar chart, and animations
- Share page at `/u/:handle` with score breakdown, tooltips, and embed snippets
- Creator Studio at `/studio` with 9 visual customization categories
- GitHub OAuth login for verified badges
- Badge verification via HMAC-SHA256 hash at `/api/verify/:hash`
- Admin dashboard at `/admin` with user management and command bar
- CLI tool (`chapa-cli`) for GitHub Enterprise (EMU) account merging
- Lifetime metric snapshots stored in Redis sorted sets (permanent history)
- Score history API with trend and diff calculations
- PostHog analytics integration
- Resend email notifications (first badge, webhooks)
- Warm-cache cron job for active users
- Dark/light theme support with terminal-first design system
- Comprehensive test suite (130+ test files, 2100+ tests)
- CI/CD with GitHub Actions (tests, typecheck, lint, security scanning, bundle analysis)
- Public release documentation (LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY)
