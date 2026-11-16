---
trigger: always_on
---

# Workspace AI Development Protocol & Governance Rules

All developers and AI coding assistants implementing or modifying features that leverage AI in this repository MUST strictly follow the protocols below:

### 1. Mandatory Core AI Layer Adoption
- All AI workflows must route through the centralized engine at `@/lib/ai` using `runCoreAiAnalysis`.
- Direct invocation of external LLM SDKs (e.g., `GoogleGenAI`, `OpenAI`, `Anthropic`) directly inside feature modules or individual API routes is strictly prohibited.
- Module-specific files (`src/modules/...`) are restricted to domain prompt engineering, domain output interfaces/schemas, and domain-specific deterministic fallback math.

### 2. Human-in-the-Loop & Advisory Boundary (EU AI Act Article 14)
- **Advisory Only:** AI outputs must NEVER directly mutate database records, commit ERP transactions, post ledger entries, update stock levels, or alter contracts.
- **Human is the Sole Decision-Maker:** The human operator is always the final decider. All UI components presenting AI findings must display advisory notices, require explicit human review actions, and allow dismissal.
- **Non-Autonomous Directives:** All domain system prompts must inherit the core governance directives (`BASE_GOVERNANCE_DIRECTIVES`) explicitly prohibiting the LLM from executing or approving transactions.

### 3. GDPR Compliance & Privacy by Design (Articles 5, 6, 9, 22)
- **Data Minimization (Art. 5):** Never send raw transactional ledgers, bulk database dumps, or employee rosters to AI models. Data must be aggregated into high-level summary KPIs and capped at 30 sample rows.
- **Strict Key Stripping & PII Scrubbing (Art. 6 & 9):** All payloads must undergo dual-pass sanitization via `guardrails.ts`. Automatically strip credentials, bank details, tax IDs, salaries, and sensitive fields, and redact emails, phone numbers, and IP addresses.
- **No Sensitive Logging:** Telemetry and server logs must NEVER log prompt bodies, raw business data, or LLM response texts. Only track execution latency, model tags, token estimates, and error codes.
- **Automated Decision-Making Prevention (Art. 22):** The system must disallow automated penalties, cancellations, or terminations driven solely by AI.

### 4. Subscription & Tier Enforcement
- Every module utilizing AI must enforce tier ceilings (`basic`, `pro`, `executive`) via `src/lib/ai/tiers.ts`.
- Requests must be validated on the backend against the user's verified subscription level to prevent client-side tier tampering or unauthorized token budget consumption.

### 5. Zero-Crash & Offline Deterministic Fallback
- Every module integrating AI must implement an offline, rule-based deterministic fallback engine.
- If the AI model fails, times out, rate limits (429/503), or has no API key configured, the system must seamlessly fall back to deterministic findings with zero crashes, clearly marked fallback flags (`isFallback: true`), and standard governance disclaimers.

### 6. Development Comments Rule
- Always leave behind clear, professional comments on all changes, workflows, and type definitions for efficient long-term maintainability.

