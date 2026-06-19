# Code Review Standards

## Turnaround
- Author self-reviews diff before requesting review
- Reviewer responds within 1 business day
- Blocking feedback must include a suggested fix, not just a critique

## Author checklist (before requesting review)
1. `npx tsc --noEmit` — zero errors
2. `npx expo lint` — zero warnings
3. New backend endpoints: JWT validated, body size limited, rate limit applied
4. New DB queries: RLS filter present
5. Financial operations: audit log entry written
6. PII fields: masked in API responses; encrypted if stored

## Reviewer checklist
1. **Security**: no RLS bypasses, no raw account numbers returned, no secrets in env vars
2. **Types**: no `any` without comment explaining why
3. **Error handling**: mutations have try/catch; edge functions return structured errors
4. **Testing**: critical paths have at least a happy-path test

## Commit message format
```
<type>(<scope>): <short description>

Types: feat, fix, chore, docs, test, refactor, perf, sec
```

## Branch naming
- `feat/<ticket>-<description>`
- `fix/<ticket>-<description>`
- `sec/<description>` (security patches — fast-track review)

## Merge strategy
- Squash merge to `main`
- Delete source branch after merge
- `main` → auto-deploys to production via Vercel
