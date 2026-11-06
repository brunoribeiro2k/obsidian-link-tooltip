# Full paths

Covers the **Show full path for internal links** and **Show tooltips for links
that already show their destination** settings (#56). Each case lists the
expected tooltip with the full-path setting on; flip the other settings to see
the second column of the table in #56.

The default settings (both off) are covered by the other notes.

## Full path on — EXPECT: TOOLTIP with the resolved path

- [[Deep note]] → `Projects/2026/Deep note.md`
- [[Deep note|an alias]] → `Projects/2026/Deep note.md`
- [[Deep note#A heading]] → `Projects/2026/Deep note.md#A heading`
- [a markdown link](Deep%20note.md) → `Projects/2026/Deep note.md`
- [[#Same-note target|same-note heading]] → `Full paths.md#Same-note target`

## Full path on, missing note — EXPECT: TOOLTIP with the target and "not created yet"

- [[Not a note|an alias]] → `Not a note` · not created yet

## Full path on, path already written out — EXPECT: NO TOOLTIP (TOOLTIP if "already show" is on)

- [[Projects/2026/Deep note]]
- [[Target]] (a root note: its full path is its name)
- [[Not a note]] (missing, and the target is all there is to show)

## Already visible — EXPECT: NO TOOLTIP (TOOLTIP if "already show" is on)

These repeat what the link shows, so they only get a tooltip with
"Show tooltips for links that already show their destination" on:

- https://example.com/raw
- <https://example.com/angle>
- [https://example.com/same](https://example.com/same)
- [[Target|Target]]
- [[Target]] (full path off)

## Same-note target

The heading the same-note link above points to.
