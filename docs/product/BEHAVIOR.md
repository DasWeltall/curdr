# Better judgment, less noise

The contract is in `backend/app/prompts/cofounder.md`; the matching portable Hermes skill is in `skills/curdr-cofounder/`. The curdr gateway applies its core contract to curdr requests. Installing a skill into Hermes makes it available on demand; it does not automatically replace Hermes's global personality or enable schedules.

## Four modes

| Situation | Desired behavior | Failure to avoid |
| --- | --- | --- |
| Brain dump | Preserve the original; separate obligations, ideas and worries; propose at most three next actions; park the rest | Turn every thought into a task |
| Decision | Recommend one option, name its weakest assumption and opportunity cost, suggest a cheap falsifiable test | Agree for encouragement, or disagree performatively |
| Authorized work | Execute within scope, verify a concrete result, request input when a real blocker appears | Keep asking permission for the same scope or claim an unverified result |
| Scheduled check | Show a changed fact, source, why it matters now and a next move; otherwise stay silent | Paraphrase yesterday's warning or send filler check-ins |

Morning briefs include priorities, what to ignore, input needed and one smallest next move. Motivation references observable work, not streaks, flattery or fictional metrics. Stage and capacity change the recommendation: a paying customer's deadline may matter more than a generic customer-interview rule.

## How to improve it

1. Keep a small, fixed behavior set in `evals/founder-behavior.json`. Include actual failures, with private details removed and the owner's permission.
2. Run one case against a sandbox Hermes with isolated sessions and mocked or read-only tools. Never run approval or outbound-action cases against production tools. Record model/provider, prompt revision, transcript, tool effects, latency and usage.
3. Grade the outcome and tool behavior against each case's rubric. A short answer alone is not evidence of good judgment. Fail fabricated facts, unapproved side effects and scope leaks outright.
4. Repeat changed cases across several trials when paying for evaluation is authorized. Compare against the same baseline before changing defaults. Review misses by hand; a second LLM's opinion is not ground truth.
5. Prefer a smaller correction to the instructions, context or tool contract over adding another permanent agent loop. Verify improvements with the same cases.

`evals/founder-behavior.json` is a review set, not a claim of passed model evaluations. Unit tests verify storage, permissions, scheduling and dispatch; they do not prove that a model will always be proactive or wise.

## Proactivity and cost

Keep the gateway and Hermes running; enable only the routines the owner wants. Checks support 30/60/180/300 minutes and respect quiet hours/sleep. The same prompt can produce different reminders, so exact text deduplication is only a basic safeguard. Semantic duplicate suppression, a configurable daily interruption budget, deterministic event-triggered checks and per-routine usage reporting remain next engineering work, not shipped guarantees.

Proactivity should earn its place with accepted useful findings and completed work. Track false alarms and dismissed duplicates alongside useful interventions. Avoid optimizing for message volume or engagement.

Sources: [Hermes skills](https://hermes-agent.nousresearch.com/docs/guides/work-with-skills), [Anthropic agent evaluation guidance](https://www.anthropic.com/research/demystifying-evals-for-ai-agents), [simple agent patterns](https://www.anthropic.com/research/building-effective-agents).
