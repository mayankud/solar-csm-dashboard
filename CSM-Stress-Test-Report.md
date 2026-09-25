# Customer Pulse stress test — September 25, 2026

## Result and scope
The implemented rules and investigation workflow exceed the requested 90% synthetic case pass target. This is specification conformance, not measured AI accuracy, churn prediction accuracy, or retention lift. There is no connected language model. No production customer data was used and no production server was load-tested.

| Evaluation | Before correction | Final |
|---|---:|---:|
| Development scenarios | 400 / 600 (66.7%) | 600 / 600 (100%) |
| Reserved date/volume variants | Not used to select fixes | 600 / 600 (100%) |
| Seeded combinations of risks and lifecycle | Not run before fixes | 500 / 500 (100%) |

The first two sets use 24 scenario families, five industry labels, and five volume variants. Industry labels are metadata, not independent industry validation. Reserved variants use different dates (including a year boundary) and volumes but the same scenario families. The 500 combination cases use deterministic seed 930517 and independently assemble expected action sets from scenario inputs. These are synthetic fixtures with expected answers authored during this work, not expert-blind or real-world validation. All required actions, evidence references, owners, valid due dates and success/escalation criteria must pass for a scenario to count as passing. The report does not count every assertion as a separate customer.

## Failures corrected
1. Exact 20% declines could miss alerts due to floating-point arithmetic. Threshold comparison now handles rounding tolerance.
2. Payment-only risk could suggest investigating activity. It now suggests invoice/dispute resolution.
3. Healthy accounts approaching renewal lacked renewal preparation tasks.
4. Passed renewal dates lacked verification tasks; outcome is explicitly unknown until confirmed.
5. Missing service-month data could masquerade as declining activity. Data correction takes priority.
6. Service decline hidden by another service's growth could leave an account Stable. Complete service history now produces a capped service risk contribution without double-counting aggregate decline.
7. Recovery comparisons omitted invoice overdue days.
8. Malformed context notes were admitted into the investigation.

Additional corrections: unique evidence IDs for multiple services; lifecycle-specific outreach for paused/onboarding accounts; restored Done tasks require outcome evidence; browser asset versioning prevents old scripts hiding the investigation workspace.

## Capacity and browser checks
A valid dataset of 500 clients and 20,000 service-month rows was processed locally. The measured ranking run took about 43 ms and investigation of all 500 accounts about 167 ms. These are single Node.js measurements, not browser render times, server throughput or latency guarantees. Seven invalid import cases were rejected (duplicates, negative/infinite activity, unknown customer, future source date and over-capacity customer count).

Browser checks in a separate local preview confirmed: investigation opens; recovery plan creation works; Done without outcome evidence is rejected; adding evidence allows saving; refreshing actions preserves Done status without duplicate tasks; completion alone remains Awaiting newer data; pasted HTML is shown literally without injected elements; the drawer close button remains at the top after scrolling; Escape closes it; paused outreach requests a restart milestone. The user's original tab and its unsaved plan were preserved. Existing model and investigator regressions passed.

## Features not included in the percentage
Natural-language causal analysis, learned playbooks, automatic CRM or email actions, shared multi-user assignment, AI model prompt-injection resistance, the full scenario simulator UI, and real-world outcome calibration are not implemented or evaluated by this result. Notes are stored, not semantically interpreted. The adversarial note check verifies that current rules do not execute note content; it does not establish future model safety.

For a real AI quality target, first connect a model, use independently reviewed account cases with expected actions, and evaluate evidence accuracy, unsupported claims, action relevance and correct abstention on a fresh held-out set. Every consequential incorrect action should be reviewed even if average performance exceeds 90%.

## Reproduce
From the project directory:

```sh
node stress-evaluate.cjs development stress-round-2.json
node stress-evaluate.cjs holdout stress-holdout.json
node stress-combinations.cjs
node model.test.cjs
node investigator.test.cjs
```

Raw outputs: stress-initial.json, stress-round-2.json, stress-holdout.json, stress-combinations.json in the repository root. The initial failure results are retained unchanged.
