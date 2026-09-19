# Wedding sheet scrolling regression

## Cause and scope

Both `WeddingMomentEditor` and `WeddingMomentDetail` use the wedding-only
`WeddingSheet`. Other app modals do not import this wrapper.

The old fixed native dialog had only a max-height and relied on the browser's
`overflow: auto` for scrolling the entire dialog, including the sticky header.
It applied raw `visualViewport.offsetTop` to its top position, opened/focused before
applying viewport measurements, and never explicitly reset its scroll offset.
An overflow-only body lock also allowed iOS keyboard-related document panning.
There was bottom safe-area padding but none at the top.

Reproduction using the committed pre-fix CSS in Playwright WebKit, at 390 x 844:
with a simulated visual viewport offset of -120px, dialog top was -108px and header
top was -107px **while dialog.scrollTop was already 0**. Internal scrolling could
not recover content positioned outside the viewport. This demonstrates the
positioning failure, not a reproduction of an actual iPhone's keyboard event stream.
The attachment contained text only, so no iPhone screenshots were available locally.

No translateY/centering animation or transformed modal ancestor was found. This was
viewport positioning, scroll ownership and focus/locking, not a palette/content issue.

## Fix

- Mobile keeps the existing rounded treatment in a nearly full-height sheet.
- The native dialog and flex shell no longer scroll. `.wedding-sheet-scroll` is
  the single primary vertical scrolling region (`flex: 1`, `min-height: 0`).
- Header is a nonshrinking sibling of the scroller, so it cannot scroll off-screen.
- CSS uses `100dvh`, constrained by the visual viewport when the keyboard reduces
  visible space. There was no old `100vh` to replace; a definite mobile height was
  added in place of max-height-only sizing.
- Measured viewport offsets are clamped to the usable layout range, including
  negative offsets and stale offsets following keyboard dismissal. Pinch zoom
  falls back to CSS geometry instead of forcing re-layout to the zoomed viewport.
- Viewport geometry is applied before showModal; opening resets scroll to zero.
- Initial focus is on Close rather than a text input. Tapping an input opens the
  keyboard normally. Inputs remain at least 16px.
- Resize/focus handling adjusts only the content scroller if a field is obscured;
  it never uses scrollIntoView on the document or resets the user's scroll while
  they manually read another part of the sheet.
- Top and side safe-area insets are applied to the header. Side/bottom insets are
  applied inside the content scroller. No app-shell inset is counted twice.
- Background body is fixed at its saved scroll coordinates while open. Its prior
  inline styles and the timeline scroll position are restored on close, and focus
  restoration uses preventScroll.
- Desktop preserves the bounded, top-inset modal with content-sensitive height.

The visual viewport can shrink independently of layout when a keyboard opens;
see [MDN VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport).
The overflow-only lock weakness is documented in
[WebKit issue 240860](https://bugs.webkit.org/show_bug.cgi?id=240860).

## Run

```sh
npx playwright install chromium webkit
npm run test:wedding:sheets
npm run build
```

The fixture bundles the **real** wedding editor, viewer, sheet, timeline and CSS.
Only next/image and the data-service boundary are replaced for this isolated test.
No Firebase requests, account credentials, real memories or backend changes are used.
The fixture is served on localhost:3107, not registered as an app route.

20 tests cover Chromium and WebKit at 390 x 844, 393 x 852, 430 x 932 and desktop
1280 x 900: initial top, full scrolling both directions, title/caption/story focus,
simulated keyboard height and pan, stale/negative offsets, reopening, background
lock and scroll restoration, gallery navigation, personal note entry, confirmation
cancel/remove, status toggle, and mocked add/edit submission. React StrictMode is
enabled. Timeline scrolling after close is also checked. Photos and path remain
the existing real components rather than separate visual copies.

Other feature modal flows were not interactively retested: their code, CSS and
wrappers were not changed. The app build checks their compilation alongside this fix.

## Still check on a physical iPhone

Browser engines and simulated visual viewport events do not reproduce the native
iOS keyboard or nonzero hardware safe-area insets. In the installed PWA, open both
sheets from halfway down the timeline; type in Title, Caption, Story and a personal
note; dismiss the keyboard; scroll to both ends; close and reopen. Confirm the header,
save/remove actions and timeline position remain correct, including after rotation.

Nothing was deployed. No Firestore, Storage, Functions or palette changes were made.
