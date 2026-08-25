## Resolution

Migration done by hand against the #38 spec — the harvester itself is not built yet, so this vault state doubles as its first idempotence test vector.

### What was done

- **FPGA note** (`knowledge/field-programmable-gate-arrays-fpgas.md`): the APIO repo, metastability-experiment, and FIFO-paper links moved out of prose into the note's `## Resources` section; the FIFO YouTube-redirect URL replaced with the real Cummings SNUG2002SJ FIFO1 PDF (`http://www.sunburst-design.com/papers/CummingsSNUG2002SJ_FIFO1.pdf`); the old heading-level `[[resources#Field-Programmable Gate Arrays (FPGAs) - Resources]]` pointer deleted.
- **Both hand-curated `resources.md` entries absorbed**: "DigiKey - FPGA series introduction" is now declared by the FPGA note; "Mastering Verilog in 1 hour" is declared by a new `## Resources` section in `knowledge/verilog.md`.
- **First rewrite pass** applied per spec §3: all six resource links are now `[[resources#^res-<id>|original text]]`, ids = first 8 hex of SHA-256 of the verbatim URL (#37): `res-9ce8f1e8` (DigiKey intro), `res-28effa99` (APIO), `res-cbe39f8c` (metastability), `res-4e71506a` (FIFO paper), `res-db27fa43` (Software Foundations), `res-59ffaaf2` (Mastering Verilog).
- **`resources.md` rebuilt** inside `<!-- BEGIN GENERATED -->` / `<!-- END GENERATED -->` markers per spec §5: topic sections coq, fpga, formal-verification, hdl, toolchain, verilog (alphabetical by tag; entries alphabetical by title; Software Foundations appears under coq + formal-verification from its single declaring note) plus the URL-sorted `## References` registry carrying the inline `^res-…` markers. Old hand-curated headings removed; frontmatter preserved outside the markers.

### Resulting facts later tickets depend on

- Registry ids now live in the `resources.md` `## References` section; every resource wikilink in note bodies resolves against them.
- The future `tools/resource-harvester/` build (#38 spec) must render this state byte-identically on its first run — this is the idempotence baseline.

### Verification

`npm run lint:vault` → no violations; `npm test` → 148/148 pass, including the real-vault smoke test. No new decisions surfaced; no fog graduated.
