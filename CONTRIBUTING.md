# Contributing to Chapa

Thank you for your interest in contributing! This guide covers how to set up your development environment, submit changes, and follow our conventions.

## Code of Conduct

All contributors must follow our [Code of Conduct](CODE_OF_CONDUCT.md). Be respectful and constructive.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (via corepack: `corepack enable pnpm`)
- A GitHub OAuth App for local development

### Setup

```bash
git clone https://github.com/juan294/chapa.git
cd chapa
pnpm install
cp .env.example .env.local
# Fill in your GitHub OAuth App credentials and other values
pnpm run dev
```

The dev server runs on **port 3001**.

## Development Workflow

1. **Open an issue first** describing the change you want to make
2. **Fork and branch** from `develop` (not `main`)
3. **Write tests first** (TDD) before implementing
4. **Make your changes** in small, focused commits
5. **Run the full check suite** before pushing:
   ```bash
   pnpm run test
   pnpm run typecheck
   pnpm run lint
   ```
6. **Open a pull request** targeting `develop`

### Branch naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/short-name` | `feature/heatmap-animation` |
| Bug fix | `fix/short-name` | `fix/oauth-token-expiry` |
| Refactor | `refactor/short-name` | `refactor/scoring-pipeline` |

### Commit messages

We use conventional commits:

```
feat(badge): add heatmap fade-in animation (#12)
fix(oauth): handle token expiry on callback (#7)
test(impact): add boundary tests for confidence clamp
```

Prefixes: `feat`, `fix`, `test`, `refactor`, `chore`, `docs`

## Test Requirements

- **All PRs must have passing tests.** CI runs the full suite automatically.
- **New features need tests.** Write them before or alongside the implementation.
- **Bug fixes need a regression test.** Reproduce the bug in a test first, then fix it.
- Tests live next to source files: `impact.ts` has `impact.test.ts`.

## Code Style

- TypeScript strict mode
- ESLint for linting (run `pnpm run lint`)
- No copyleft dependencies (MIT, Apache-2.0, BSD, ISC only)
- Escape all user input in SVG rendering
- Use design system tokens, not hardcoded colors (see `docs/design-system.md`)

## Pull Request Checklist

- [ ] Tests pass locally (`pnpm run test`)
- [ ] TypeScript compiles (`pnpm run typecheck`)
- [ ] Lint passes (`pnpm run lint`)
- [ ] Commit messages follow conventional commits
- [ ] PR targets `develop` (not `main`)
- [ ] New features include tests
- [ ] No secrets or credentials in code

## Questions?

Open a [GitHub Discussion](https://github.com/juan294/chapa/discussions) or reach out at support@chapa.thecreativetoken.com.
