# ADR 002: PCI compliance via Stripe-hosted UI

**Status**: Accepted (2024)
**Context**: We process payments but want to avoid PCI DSS scope expansion.
**Decision**: Use Stripe-hosted Checkout, Elements (web), and Customer Portal (native). Card numbers never touch our servers.
**Rationale**: Achieves PCI SAQ-A (minimal scope). Stripe handles tokenization, 3DS, fraud detection.
**Trade-offs**: Less UI control; native card management requires a web browser handoff.
**Alternatives rejected**: Stripe.js with custom card form (SAQ A-EP); direct ACH (higher risk/compliance burden).
