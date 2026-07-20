# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.x     | ✅ Yes    |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

To report a security vulnerability responsibly:

1. **Email**: Send details to the maintainers via the email listed in the npm package metadata.
2. **GitHub Private Advisory**: Use GitHub's [private security advisory](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability) feature in this repository.

Please include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested mitigations (optional)

## Response Timeline

- **Acknowledgement**: Within 48 hours of receipt.
- **Assessment**: Within 5 business days.
- **Fix / Disclosure**: Within 30 days for confirmed vulnerabilities; coordinated with the reporter.

## Supply-Chain Security

- **Lockfile policy**: This project maintains a `package-lock.json`. Contributors must commit lockfile changes and CI enforces `npm ci`.
- **No postinstall scripts**: This package defines no `postinstall`, `install`, or `preinstall` lifecycle scripts. It will not execute arbitrary code during installation.
- **npm provenance**: Releases are published with `--provenance` via GitHub Actions, linking each package version to its source commit and build log.
- **Dependency auditing**: Run `npm run audit:deps` to check for known vulnerabilities. CI runs this on every pull request.
- **Minimal dependencies**: Runtime dependencies are kept to a minimum and are reviewed on each addition.

## Dependency Audit

```bash
npm run audit:deps
# equivalent to: npm audit --audit-level=moderate
```

Run this before publishing to catch known CVEs in the dependency tree.

## Scope

This policy covers:
- The `ctxpacker-tool` npm package
- Its runtime and development dependencies
- The CLI behavior as documented

Out of scope:
- Vulnerabilities in code analyzed by the tool (the tool reads files but does not execute them)
- Issues in projects that consume the generated context packs
