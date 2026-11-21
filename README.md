# csv-reader-fast

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/Rynnnzen/csv-reader-fast/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/Rynnnzen/csv-reader-fast/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's csv-reader 1.0.0 — exact answers, single-pass scanner.

`run(input)` returns exactly what csv-reader 1.0.0 returns for every `{text, header}`: the header (or `null`), every record padded or cut to the first record's width, and every broken thing it met (`stray_cr`, `quote_junk`, `unterminated_quote`, `short_row`, `long_row`) — including the reference's own broken-row policy for stray CRs, doubled quotes, CRs inside quotes, junk after a closing quote, and unterminated quotes replayed as unquoted fields.

The speed comes from a fused scanner: whole fields taken with one `slice`, a pieces array built only when a field actually transforms, numeric termination states instead of per-field objects, and no per-character string building.

## Run it

```sh
node main.ts
```

`main.ts` reads every case from `$MAKEFUN_INPUT_DIR/cases.json` (default `/input/cases.json`), answers each one with `run` from `solve.js`, and writes `$MAKEFUN_OUTPUT_DIR/answers.json` (default `/output/answers.json`). Node 22 or later. No dependencies.

<sub>Entered on [make.fun](https://make.fun/?ref=3nca7vjq&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
