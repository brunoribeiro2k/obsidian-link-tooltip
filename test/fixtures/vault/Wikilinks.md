# Wikilinks

## Aliased — EXPECT: TOOLTIP

- [[Target|a friendly alias]]
- [[Some note#A heading|aliased heading]]

## Bare — EXPECT: NO TOOLTIP (TOOLTIP if "already show" is on)

The destination is already visible:

- [[Target]]
- [[Some note]]

## Embeds — EXPECT: NO TOOLTIP (with any setting)

![[Target]]
![[Target|aliased embed]]
