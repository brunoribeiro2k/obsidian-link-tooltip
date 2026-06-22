# Edge cases

## Range boundaries — EXPECT: TOOLTIP only while inside the link (#29)

Hover slowly across the link and watch the tooltip appear and disappear exactly
at the brackets:

[boundary test](https://example.com/boundary)

The character immediately after the closing paren must NOT show a tooltip.

## Nested brackets in label — EXPECT: TOOLTIP

[label [with] brackets](https://example.com/nested)

## Escaped brackets — EXPECT: NO TOOLTIP (not a link)

\[not a link\](https://example.com)

## Multiple links on one line — EXPECT: TOOLTIP on each

See [first](https://example.com/1) and [second](https://example.com/2).
