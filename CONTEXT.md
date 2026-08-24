# Context

Glossary for the vault domain. Glossary only — no implementation detail lives here.

## Resource

An external URL catalogued for later search. It lives exactly once, as a line in a note's Resources section; `resources.md` holds generated views of it, grouped by topic tag.

## Resources section

The `## Resources` heading of a note. The only place harvesting looks. A link written here declares itself a Resource; links in prose never do.

## Harvesting

The sync-time act of collecting Resources from note bodies via Patterns and rewriting them into Resource wikilinks. Membership is stateless: a raw URL and an existing Resource wikilink both count as present; deleting the line anywhere removes the Resource.

## Pattern

One ordered matcher in the harvester's registry, recognizing a single link syntax. First match wins. Adding a Pattern never changes how older ones behave.

## Resource wikilink

`[[resources#^<id>|<original link text>]]` — a wikilink pointing at the Resource's registry line. The id is `res-` followed by the first 8 hex digits of the SHA-256 of the Resource URL, so the same URL always carries the same id.

## Reference list

The grep-friendly list at the bottom of `resources.md` holding one anchored line per Resource — the id↔URL registry and the only target of Resource wikilinks.

## Topic section

One `## <tag>` heading in `resources.md` per tag in the union of all contributing notes' tags. A Resource appears under every tag of its owning note; within one section, entries are unique by URL. Topic sections are plain views of the registry and carry no anchors.

## Change review

The diff-gated pass over recently changed vault notes: detect which files and hunks changed, then check them for misspellings and wrong words. Reports findings; never blocks a push and never edits bodies.
