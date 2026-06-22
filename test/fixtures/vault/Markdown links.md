# Markdown links

A tooltip should reveal the hidden destination of every Markdown link.

## External — EXPECT: TOOLTIP

- [Anthropic](https://www.anthropic.com)
- [escaped parens](https://example.com/a_\(b\)_c)
- [angle-bracket dest](<https://example.com/has space>) <!-- #30 -->

## Internal — EXPECT: TOOLTIP

- [a note link](Some note)
- [a heading link](Some note#A heading)

## Bare — EXPECT: NO TOOLTIP

Bare autolinks already show their destination:

- https://example.com
- <https://example.com>

## Image embeds — EXPECT: NO TOOLTIP

![alt text](https://example.com/image.png)
