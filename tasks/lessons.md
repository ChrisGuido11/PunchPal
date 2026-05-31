# Lessons

Append a rule here whenever a user correction during the session reveals a mistake worth not repeating. One bullet per rule, lead with the imperative, follow with the "why" the user gave.

## Phase 1 (shipped a030f39 2026-05-20)

(No corrections recorded.)

## Phase 1+2 (shipped 2026-05-22)

- NEVER clamp a derived progression value inside the Zustand setter when the overflow matters downstream. The setter is the wrong layer — clamp inside the pure logic module (`progression.ts`) where the decision rules can choose between "pin at 100" (staying / advanced) and "let overflow flow" (organic level-up). Reason: the level-up carry (e.g., 95 + 10 = 105 → advance with 5 as starting progress at new level) gets lost if the store setter clamps to 100.
- Keep strict `parse()` separate from tolerant `tryParse()` when extending a notation grammar. Tests for legacy expanders/hashers/generators rely on "return empty on bad input" semantics; if `parse()` throws strictly, layer the legacy functions on top of `tryParse()` so the existing test corpus keeps passing while new tests can assert on the strict errors.

## Dynamic-mode combo cycling fix (OTA 2026-05-22 PM)

- NEVER write a rotating-pool scheduler as `if (idx >= pool.length) return;`. If the pool is sized by a generator that can produce fewer than the scheduler's requested count (tier limits, small anchors, validity gates), the loop will silently terminate mid-round instead of cycling. Use `effectiveIdx = idx % pool.length` and let wall-clock termination be the only stop signal. Symptom that this rule prevents: works in tests with healthy anchors, dies in production for the smallest inputs (often the most common ones).
- Speech-duration estimators need empirical calibration, not just per-word baseline multiplied by char count. iOS Siri male voices at rate 0.95 run ~600-700ms/word, not the 400ms our default estimator uses. Downstream timers calibrated against under-estimates make silence gaps feel longer than the constant suggests. Either calibrate per-device or apply a safety multiplier to all estimates.

## Variety + mode-mismatch fixes (OTA 2026-05-24)

- NEVER send hashes to an LLM and ask it to "avoid hash collisions." LLMs don't run hash functions. PunchPal sent FNV-1a hashes of recent combos to Claude with "avoid these hashes" instructions for weeks before discovering Claude was treating them as opaque strings (better than nothing but unusable for the intent). Send the raw signal the model can interpret — actual notations, actual names, actual content.
- When a variety/avoid signal can be globally useful, make it ALWAYS-ON, not conditionally-rendered. PunchPal's `recent_combo_signatures` was wired only inside `at_level_cap === true`. Result: 99% of users (progressing through tiers) got zero signal and Claude generated near-duplicate workouts. Lesson: gate signals on "do we have data to send?" not on "is the user in a special state?" Layer special-state directives ON TOP of always-on signals, never IN PLACE OF them.
- When a fix depends on a new field on persisted state, account for the "stale persisted data on cold launch" case. PunchPal's initial mode-mismatch fix had `if (!currentWorkout.mode) return;` which silently no-op'd for any workout generated before the fix shipped. User cold-launched, toggled, nothing happened — looked totally broken even though the code was correct. Either: (a) bump the persist version + migrate the persisted state to clean values, or (b) treat undefined as a mismatch so the fix heals on first user action. Option (b) is cheaper and was the right call here.
- When the avoid/variety signal is a ring buffer, push to it on workout *generation*, not just on completion. Otherwise users who spam regen-without-playing send identical inputs to the LLM and get identical outputs back. Dedup the buffer so double-pushing the same item is idempotent.
- When adding a field that needs to live in a type file but its type is currently defined in a state/store file, MOVE the type definition to the type file and re-export from the store, not the other way around. Otherwise you get a circular import (types → store → types). Easy fix at the design moment; painful later.
- Reuse existing interstitial-ad infrastructure as a natural debounce for "expensive operations the user triggers via UI." PunchPal's mode-toggle regen costs an EF/LLM call; gating it through `freshWorkoutAd.show()` means the 30s ad-frequency cap rate-limits toggle-spam for free, AND every triggered regen serves an ad (revenue). Two structural problems solved with one existing primitive.

## Adaptive learning (Phase 4.1, OTA 2026-05-24 PM)

- For any per-user counter that increments on a user action, prefer a Postgres function with `INSERT … ON CONFLICT DO UPDATE` over a client-side `SELECT … then INSERT/UPDATE` flow. The client pattern has a race window where two concurrent calls both see "no row exists" and both INSERT, producing duplicates or unique-constraint errors. The atomic RPC eliminates that entirely. PunchPal's `punchpal_record_combo_rating` is the canonical example.
- When repurposing a dormant schema table for a new use, audit every NOT NULL constraint against the new use case. `punchpal_combo_progress.combo_name` was set NOT NULL in migration 001 (for a UI that displayed combo names) but the Phase 4.1 use case stores arbitrary notations without semantic names. Had to relax the constraint as part of migration 005.
- Cold-start gating belongs in the CLIENT, not the server, when the gating depends on user history. The EF can't tell "user has rated 0 workouts" from "user has rated 50 workouts but none recently fit a pattern." The client owns `workoutHistory >= 5` and either fetches+sends the signal or skips entirely.
- Aggregation queries that feed prompt context should be CAPPED at both the SQL layer (LIMIT 30) and the client layer (top 8 in each bucket). The SQL limit bounds the read cost; the client limit bounds the prompt-token cost. Double-cap so neither layer alone can blow the budget.

## Adaptive sprints 1-4 + Skip Combo + Phase 6 (committed 2026-05-26)

- When you turn a soft "avoid these" LLM instruction into a hard guarantee, mirror the client's canonicalization into the EF and DROP violating outputs there, then fail closed to a canned fallback. We added a `forbiddenSet` to `validateAndFixRound` (canonical notations via `parseCombo`+`serializeCombo`) and 422 when <3 rounds survive. A soft prompt rule drifts; the deterministic server filter is the only thing that guarantees a struggle combo never reaches the user.
- Re-implementing the same grammar/parser in two runtimes (mobile TS lib + EF Deno) is a drift hazard — keep them byte-for-byte equivalent on canonicalization or the server filter and client expectations diverge. Every grammar change must touch BOTH `combo-variations.ts` and the EF's inlined parser in the same commit.
- Gate noisier signals behind higher evidence thresholds. The per-combo difficulty signal cold-starts at 2 rated workouts, but the broader per-FEATURE signal (e.g. "struggles with body shots") waits for 5 — one bad rating shouldn't condemn a whole category. Match the threshold to how much a wrong inference costs.
- Bumping a persisted Zustand store schema version requires a migrate step that invalidates incompatible cached payloads. Going userStore v1→v2 had to null `currentWorkout` because the v1 shape (`combos[]`) renders wrong against v2 (`rounds[]`). A version bump without a migrate that clears stale shapes = crash/garbage on first launch after update.
- For balanced two-line auto-shrink text in React Native, expose exactly ONE break opportunity instead of a hard `\n`. `balancedTwoLineWrap` converts spaces/hyphens to non-breaking forms (U+00A0 / U+2011) and inserts a single U+200B at the midpoint — a literal newline disables `adjustsFontSizeToFit` and greedy wrap overstuffs line 1.
- A reversed scope decision must be reversed IN THE DOC, not just superseded by silence. Skip Combo was logged as "cut from scope," then shipped — the old decision had to be explicitly marked SUPERSEDED so a future reader doesn't trust the stale line. Contradictions between the tracking doc and the code are worse than a missing entry.

## Boxing-mechanics edge cases (committed 2026-05-27)

- Orthodox-stance biomechanics, hard rule: `slip_right`/`roll_right` load the REAR hip → next punch must be rear-hand (2/4/6); `slip_left`/`roll_left` load the LEAD hip → next must be lead-hand (1/3/5). When you flip a slip/roll DIRECTION in a variation you MUST also mirror the following punch's hand (1↔2, 3↔4, 5↔6) or the combo becomes physically impossible. Encode it as `punchHand(p) = n%2===1 ? lead : rear` and validate every defense against its immediately-following punch.
- A feint must never be followed by the same punch you faked (feint_jab→1, feint_cross→2, feint_hook→3/4, feint_uppercut→5/6 are all redundant). Faking a level then throwing it teaches nothing — enforce feint→following-punch sanity in the generator AND the server validator.
- Validate boxing biomechanics on the SERVER and fail closed (reject round → 422 → canned fallback), not just in the LLM prompt. Prompt rules drift across regenerations; a deterministic validator is the only guarantee a user never drills broken form.
- Any single coaching cue (pivot_left, slip_right, one feint type) repeated for a full 3-minute round reads as a parrot bug. Build variety at BOTH levels — within-round (rotate footwork direction/family, cycle feint types) and workout-level (cap any one footwork token at 2 anchors, force ≥2 families, no slip direction >60%). Don't fix only the first symptom you're told about and leave the sibling tokens repeating.
- When deprecating a token that may exist in saved user data (feint_high/feint_low), exclude it from NEW generation but keep the PARSER accepting it — otherwise replaying an old saved combo crashes. Separate the generation pool (`FEINT_CYCLE`) from the parse grammar.
- When loosening a "preserve at least one embedded move" rule to allow variety, swap exact-token matching for FAMILY matching (`moveFamily`) — but only group tokens that are biomechanically interchangeable. Footwork and slip/roll collapse to families; block/parry stay exact because a direction/technique swap there breaks form.

## Android App Open ad (committed 2026-05-31)

- `react-native-google-mobile-ads` App Open ads emit NO failed-to-show callback. Drive state off OPENED/CLOSED/ERROR plus a short watchdog (`setTimeout` ~3s) AND a `.catch` on the `show()` Promise, or the in-flight guard sticks and the format dies for the whole session.
- Share ONE module-level `isFullScreenAdShowing` flag across every full-screen format (interstitial + App Open) and consult it before showing. On Android each renders in its own Activity, so a resume after an interstitial is indistinguishable from a genuine re-open without this mutex — and App Open ads will stack on interstitials.
- Disambiguate "app resumed" from "ad dismissed" by snapshotting `isFullScreenAdShowing` at the moment the app is BACKGROUNDED, not at resume time — sampling at resume races the CLOSED event.
- App Open ads expire ~4h after load and the native `load()` no-ops on a stale-but-still-loaded instance. Force a fresh instance (bump a `reloadKey` feeding the `useMemo`) on expiry instead of calling `load()` again.
- A commit titled "Refactor for readability" that actually contains binary build artifacts, renamed assets, and a versionCode bump is a documentation hazard — and committing ~90MB `.aab` build outputs bloats the repo permanently. Gitignore `*.aab` and keep commit messages honest about what changed.
