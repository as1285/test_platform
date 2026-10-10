# Device policy table (draft)

Path: `frontend/public/js/device-policy.json`  
Served as: `/js/device-policy.json`

## Purpose

Centralize the SKU rules that today live as regex islands in `auth.js` / `auth-boot.js`:

| Field | Meaning |
| --- | --- |
| `insetMode` | `immersive` / `outer` / `underlap-black` / `ios-safe-area` |
| `shellPx` | Value for `--app-shell-statusbar-top` and `--android-status-inset` |
| `minePaint` | Mine e1 first-paint strategy (`sm-crop`, `true-ratio-lock`, `mate60-e1`, …) |
| `modelCodes` | Hardware ids (`25102RKBEC`, `ALN-AL00`, `ANA-AN00`, …) |
| `excludeFrom` | Sibling detectors / generic `@sm` paths this SKU must not enter |

Key exclusions already encoded in auth (K90 Pro Max, K70, P40, Mate60, …) are listed under each row and again in `globalExclusions.androidMineSmFirstPaintNot`.

## How auth should consume it later

1. **Boot (sync-friendly):** keep current hard-coded first-paint for zero FOUC. Optionally `fetch(/js/device-policy.json)` after first paint and assert parity in tests.
2. **Match:** `clientUaBlob()` (UA + `tax_device_model_v1`) → first device whose `modelCodes` or `matchNames` hit; skip if any `excludeFrom` sibling already matched.
3. **Apply:** set `htmlClass` + `flags`, write `shellPx` into CSS vars, branch mine CSS by `minePaint`.
4. **Thin wrappers:** leave `isRedmiK90ProMaxClient()` etc. as one-liners over the table so unit tests that grep function names keep working.
5. **Do not** auto-replace Mate60 frozen fork (`auth-mate60-aug12.js`) until policy `minePaint: mate60-e1` is proven on device.

## Draft status

Version `1` is documentation + data only. Runtime auth does **not** load this file yet. Wire when ready; until then treat JSON as the source of truth for new SKU PRs.
