# Customer Pulse · Mayank Udaywal

A configurable customer-success workspace for prioritizing retention work. Velunora is an invented demo brand; every bundled customer, CSM, value and activity record is synthetic.

## Run

Serve this folder with any static web server. For example:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. There is no build step, backend, API key, package installation or external CDN dependency. Keep all files together.

## Daily workflow

1. Start with **Priority queue**. Review the reason, monthly value, responsible owner and suggested action.
2. Open a customer to inspect the evidence and activity history. Save a follow-up plan in the current tab.
3. Use **Monthly activity** for customer → service → month counts. Missing records appear as `—`; explicit zero records appear as `0`.
4. Use **Portfolio health** for ownership, high-priority value and renewals.
5. Export the queue to retain action plans. Records and plans are session-only and reset on reload.

## Investigation and recovery plans

Open **Account investigation** for source-linked evidence, hypotheses to validate, dated actions, owners, success criteria and recovery comparisons. Add customer context, create a plan and export/restore recovery records. Marking an action Done requires outcome evidence; it does not establish recovery. All records remain session-only. Notes are stored but not interpreted by a language model. No live AI model or automatic outreach is connected.

## Validation

The September 25 synthetic stress evaluation improved from 400/600 to 600/600 development cases. Reserved date/volume variants passed 600/600; combined-risk cases passed 500/500. These are rule and workflow checks, not real-world AI accuracy or churn prediction. See [the report](CSM-Stress-Test-Report.md) for scope, limitations and reproduction commands.

## Customize for your industry

**Customize workspace** provides general-business, professional-services, software and commerce presets. Change customer, activity, service and value terminology; currency; decline threshold; minimum baseline; delivery target; and freshness tolerance.

Preferences are saved locally. Currency selection changes formatting, not exchange rates. Use one comparable activity unit and one currency per workspace. Per-service units must be additive; product-level active-user totals can double-count people across products. Use deduplicated activity or a single product for unique-user reporting.

## Import your data

In **Manage data**, download both templates, replace the demo rows and load both CSV files with an explicit snapshot date. Import is local and atomic: invalid data does not replace the current dataset. Limits: 500 customers, 20,000 monthly rows, 24 distinct months, and 2 MB per file.

Customer columns:

| Column | Meaning |
| --- | --- |
| `customer_id` | Unique stable ID: letters, digits, underscore or hyphen |
| `name`, `owner`, `segment` | Display name, responsible CSM, grouping |
| `lifecycle` | `active`, `onboarding` or `paused` |
| `monthly_value` | Nonnegative monthly equivalent, in the selected currency |
| `renewal_date` | Optional renewal date, YYYY-MM-DD |
| `last_activity_date` | Most recent order or meaningful usage event |
| `cadence_days` | Expected interval between activity events, in calendar days |
| `on_time_pct` | On-time delivery percentage; blank means unavailable |
| `critical_issues` | Number of unresolved critical issues; blank means unavailable |
| `overdue_days` | Age of oldest overdue invoice; 0 means none, blank means unavailable |
| `last_contact_date` | Last meaningful customer interaction |
| `updated_at` | Source snapshot freshness date |

Monthly columns: `customer_id`, `service`, `month` (YYYY-MM), `units`. Each customer/service/month combination must be unique. Provide explicit zeros for known inactivity. Complete service-month coverage is required for the four months used in risk comparison. All template headers are required; optional field values may be blank. Future activity months and future historical dates are rejected relative to the chosen snapshot.

## Risk logic

The priority score is deterministic, not an AI prediction or a churn probability. Default points:

- Activity decline versus the preceding three completed months: 25 points at 20%, 40 at 40%; baseline minimum 10.
- Service decline hidden by growth: 25 total points when a service meets the decline threshold, complete service history is available, and aggregate activity has not already triggered an alert.
- Silence exceeding twice normal activity cadence: 20.
- On-time delivery below 90%: 15.
- At least one critical issue: 20.
- Invoice over 30 days overdue: 15.
- Renewal in 30 days with another signal: 10.

Scores cap at 100: Critical ≥60, At risk ≥35, Watch ≥15, otherwise Stable. Stale or insufficient data overrides active-account scoring with Review data. Onboarding and Paused are separate. Optional missing fields reduce coverage; Stable means no flag among available signals, not proven customer satisfaction. The queue sorts by risk band, score and monthly value. Exposure sums monthly value for Critical/At risk accounts and is not expected revenue loss.

## Implementation

- `model.js`: synthetic dataset, validation, indexing and pure risk functions.
- `app.js`: small view functions, cached scoring, event delegation and browser-only state.
- `styles.css`, `index.html`, `favicon.svg`: responsive UI and accessible native dialogs/forms.
- Chart.js 4.5.1: local chart rendering.
- Papa Parse 5.7.0: local CSV parsing/export, including formula escaping.

Risk results are cached until data or settings change; activity is indexed rather than repeatedly rescanning the entire dataset. No application framework is required. Vendored libraries retain their licenses. See `THIRD_PARTY.md`.

Run domain checks with `node model.test.cjs`. These cover score bands, partial-month exclusion, stale/incomplete data, lifecycle handling, invalid imports and unusual identifiers.

## Privacy and deployment

No live integration, credentials, telemetry or production records are bundled. CSP disables network connections and external scripts. Customer imports and edited plans remain in memory; only terminology and thresholds use localStorage. CSV exports neutralize spreadsheet formula prefixes. User-facing imported strings are escaped before rendering.

For a shared operational deployment, add an authenticated backend, access controls, source integration and durable audit history. Those capabilities are intentionally not simulated by this static template. A public source repository must contain only synthetic data—not customer exports, deployment credentials or original development history.
