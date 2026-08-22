# The Jin AI mark

Two strokes. The second is cut at an angle **parallel to the first**, which is
what makes the notch read as deliberate rather than as a gap.

```
viewBox   0 0 390 326          (aspect 1.196 : 1 — never scale non-uniformly)
stroke 1  M234 0h71L71 326H0Z
stroke 2  M248 129 211 180 317 326 389 326Z
```

Both strokes are 71–73 units wide horizontally and share the same slope
(±0.718 x per y). Stroke 2 clears stroke 1 by a constant ~35 unit gap.

## Files

| File | Use |
| --- | --- |
| `jin-mark.svg` | Ink `#252525` on light backgrounds |
| `jin-mark-white.svg` | White, for dark bands and the vermilion tile |

For the vermilion direction the mark is drawn in `#c1362f`; inside the app
chrome it sits reversed out of a `#c1362f` tile.

## Rules

- Inline it as SVG with `fill:currentColor` wherever it should follow text colour.
- Minimum size 16px tall — it was checked at 16px and the notch still reads.
- Do not put it in a bordered box. It is a standalone glyph.
- Do not add a radius, outline, gradient or shadow.
- In the wordmark lockup the gap between mark and "Jin AI" is 10px at 22px type.

Set as favicon by inlining the same two paths into a data URI with a
`viewBox='-55 -87 500 500'` so the glyph sits centred with even padding.
