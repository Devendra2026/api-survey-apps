# Master Data Hub — Implementation Plan

**Date:** 2026-07-26  
**Spec:** [2026-07-26-master-data-hub-design.md](../specs/2026-07-26-master-data-hub-design.md)

## Done

1. Design spec written under `docs/superpowers/specs/`.
2. Hub at `/master-data` with hero, metrics, registry tabs (`?tab=` + `?category=`).
3. Redirects: reference / geography / tax-engine (+ admin geography) → hub tabs.
4. `CONFIG_NAV` + overview links + category cards point at hub.
5. Reference / Tenants / Tax Rates panels compose existing hooks and components.

## Manual verification checklist

- [ ] `/master-data` loads with Reference Data default
- [ ] Tab pills + `?tab=tenants` / `?tab=tax-rates` deep links
- [ ] `/configuration/reference` → hub reference; category redirect preserves code
- [ ] `/configuration/geography` → tenants; `/configuration/tax-engine` → tax-rates
- [ ] Add/edit reference option
- [ ] Expand geography accordion; add/edit via drawers
- [ ] Select district/ULB/ward; edit matrix; save; open Publish from overflow menu
- [ ] Demand Rules / Settings still reachable from configuration overview nav
