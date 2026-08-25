Resolution recorded for **Migrate existing links into the harvester model** (task, AFK).

The vault now lives in the harvester model, migrated by hand per the #38 spec: FPGA prose links (APIO, metastability, FIFO — redirect URL swapped for the Cummings SNUG2002SJ PDF) moved into `## Resources`; both hand-curated `resources.md` entries re-declared by notes (FPGA note + verilog.md); first rewrite pass applied — six `[[resources#^res-…|original text]]` links with SHA-256-derived ids; `resources.md` rebuilt inside the generated markers (alphabetical topic sections + URL-sorted `## References` registry). Vault-lint clean, 148/148 tests pass. The future harvester build inherits this state as its byte-identical idempotence baseline.

Full resolution: #39 · ticket closed: #39 · this map's "Decisions so far" section updated.
