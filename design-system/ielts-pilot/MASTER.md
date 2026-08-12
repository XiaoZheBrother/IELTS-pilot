# IELTS Pilot Design System

## Product read

IELTS Pilot is a local-first, information-dense education workspace. The interface should feel like a carefully typeset workbook combined with a dependable desktop utility. It is not a marketing site or a portfolio grid.

Design dials: visual variance `6`, motion intensity `3`, information density `7`.

## Visual direction

- Paper background `#F4F0E7`, bright reading surface `#FBF9F4`, ink `#161A18`.
- One action accent: signal blue `#2155FF`.
- Square rules, sharp containers and asymmetric editorial grids.
- UI uses the local system sans stack. Long reading text uses Georgia and local serif fallbacks.
- Paper, sepia and night modes change shared tokens; all three retain AA-oriented contrast.
- No gradients, glass effects, decorative dashboard charts, excessive pills or nested card stacks.

## Type and spacing

- Display titles use tight letter spacing and `text-wrap: balance`.
- Passage text targets 17px, user-adjustable scale, 1.5 to 2.2 line height and 620px to 980px measure.
- Dynamic timers, counters and report metrics use tabular numerals.
- Base spacing follows 4, 8, 16, 24, 32, 48 and 64px increments.
- UI descriptions use `text-wrap: pretty`; long passage paragraphs retain normal browser wrapping.

## Interaction

- Interactive targets are at least 40px, with 44px preferred.
- Keyboard focus uses a 3px signal-blue outline with a 3px offset.
- Hover and active feedback never changes document flow.
- Press feedback uses `scale: .96` and an interruptible 150ms transition.
- Transitions name exact properties. Never use `transition: all`.
- `prefers-reduced-motion` reduces transitions and animations to near zero.
- Buttons use text or consistent inline SVG icons, never emoji glyphs.

## Surfaces

- Layout dividers use 1px tokenized rules.
- Interactive cards use a low-opacity multi-layer shadow ring; dark mode uses a white translucent ring.
- No soft, floating SaaS-card treatment. Reports and indexes should read as ledgers.
- Forms retain explicit borders for focus and accessibility.

## Responsive behavior

- Validate at 375px, 768px, 1024px and 1440px.
- At tablet width, the primary navigation becomes a bottom rail.
- Practice and mock workspaces switch between article and questions on narrow screens.
- Dense indexes collapse their secondary metadata before actions or primary content.
- No horizontal page scrolling at supported viewport widths.

## Release checks

- Visible focus, semantic labels and live feedback are present.
- Theme colors maintain readable contrast.
- No content is hidden behind sticky headers or mobile navigation.
- Timers and updating counts do not shift width.
- Print reports include source excerpts and explanations.
- All user-facing content avoids em dash and en dash characters.
