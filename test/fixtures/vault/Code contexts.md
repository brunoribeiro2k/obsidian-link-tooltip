# Code contexts

Link-shaped text inside code is not a live link, so it must show NO tooltip.
This is the case the line-based parser could not handle (#32).

## Inline code — EXPECT: NO TOOLTIP

Here is `[x](https://example.com)` and `[[Target|alias]]` inside backticks.

## Fenced code block — EXPECT: NO TOOLTIP

```md
[x](https://example.com)
[[Target|alias]]
```

## Indented code block — EXPECT: NO TOOLTIP

    [x](https://example.com)
    [[Target|alias]]
