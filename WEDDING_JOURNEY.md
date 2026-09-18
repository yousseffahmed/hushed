# Our Road to Forever

Route: `/our-wedding`. A compact Home link opens the private wedding journey.
The app's existing pink palette, authentication, and unrelated features are unchanged.
No actual milestones, dates, photographs, or personal stories are seeded.

## Files

- `src/app/our-wedding/page.tsx`: route and page metadata.
- `src/components/wedding/WeddingJourneyPage.tsx`: allowed-user gate, subscription, loading/error states, sheets.
- `src/components/wedding/WeddingTimeline.tsx`: chronological winding path, past/now/future, photo clusters, scroll reveal.
- `src/components/wedding/WeddingMomentEditor.tsx`: shared fields, own note, multiple photo selection and previews.
- `src/components/wedding/WeddingMomentDetail.tsx`: full story, all-photo browsing, separate perspectives, removal confirmation.
- `src/components/wedding/WeddingSheet.tsx`: native modal focus management, Escape, visual-viewport sizing and safe-area padding.
- `src/components/wedding/WeddingIcon.tsx` and `wedding.css`: scoped iconography and styling; reduced-motion support.
- `src/lib/weddingTimeline.ts`: types, chronological sorting, local calendar dates, validation.
- `src/lib/weddingTimelineService.ts`: real-time subscription, transactions, uploads, cleanup.
- `src/components/anniversary/AnniversaryPage.tsx`: small Home entry only.
- `firestore.rules`, `storage.rules`: rules for the new feature only.
- `tests/weddingTimeline.test.cjs`, `tests/weddingRules.test.cjs`, `firebase.wedding-test.json`: isolated tests.
- `package.json`, `package-lock.json`: Lucide icons, rules-testing development dependency, test scripts.
- `public/images/wedding-ribbon.png`: decorative generated artwork, not a claimed photograph or memory.

## Data

Firestore: `couples/yushef/weddingTimeline/{momentId}`.

Fields: `id`, `title`, `subtitle`, `description`, `eventDate`, `plannedDate`, `status`,
`type`, `createdByUid`, `createdByName`, `photos`, `notesByUid`, `deleting`,
`createdAt`, `updatedAt`.

`eventDate` and `plannedDate` are nullable `YYYY-MM-DD` **calendar strings**, not
UTC instants. This intentionally preserves the chosen day across time zones.
Completed moments require an event date. Upcoming moments may have no planned date.
Completed moments sort oldest first, followed by Now, then upcoming moments in
planned-date order, with undated plans last. Creation/update times are server timestamps.

Each photo contains `id`, `url`, and `storagePath`. Storage path:
`couples/yushef/weddingTimeline/{momentId}/{photoId}-{safeFileName}`.
The file name remains in the path. Limits: 10 photos per moment, 5 MB per photo;
JPEG, PNG, WebP, GIF and AVIF. HEIC must be exported as JPEG if iOS does not convert it.

Both allowlisted users can edit shared details or remove a moment. Each can edit
only their own `notesByUid[uid]` entry. Both can read both notes. Transactions use
dotted note updates so a shared edit does not overwrite the partner's note.

Removal first sets `deleting: true`, preventing edits and new uploads, then lists
and deletes that moment's Storage objects, and finally deletes the document.
Failed cleanup leaves a visible retryable moment; successful removal does not
leave references to deleted photos. A batch upload that cannot attach its metadata
attempts to remove its newly uploaded files and reports cleanup failure explicitly.
Firestore and Storage are separate services, so their changes are not atomic.

## Dependencies and Motion

`lucide-react` supplies lightweight consistent icons. No animation framework was
needed: IntersectionObserver, ResizeObserver, requestAnimationFrame and CSS handle
the path and reveal. Reduced-motion preferences disable animation and reveal the path.
`@firebase/rules-unit-testing` is development-only.

Artwork generated with the image tool: two intertwined champagne-gold wedding bands
and a dusty blush silk ribbon, watercolor/colored-pencil stationery style on transparent
background, no text or people. Stored locally; no external image service at runtime.

## Verification

```sh
npm run test:wedding
npm run test:wedding:rules
npm run build
```

Rules tests run against **demo-yushef**, never production. Firebase CLI and a supported
Java runtime are needed for emulators. They cover both users, outsiders, unauthed
reads/listing, wrong couple scope, immutable authorship, note overwrite/removal,
invalid schemas and dates, ten-photo capacity with both notes, live snapshots,
upload restrictions, immutable objects, tombstoned updates, and cleanup retries.

An isolated temporary browser harness tested both emulator users through the real
UI/services: create, multi-photo upload and gallery, partner edits, independent notes,
live sync, future moments, photo removal, confirmation/cancel/delete, reduced motion,
320px/390px/1280px layouts and a 400px-high modal viewport. No runtime errors or
horizontal overflow were observed. The harness was removed before the build.
Only the local harness accepted emulator photo URLs; production remains HTTPS-only
for Firebase Storage images.

On two iPhones, also verify the native keyboard, photo-library picker, Home Screen
safe areas, long titles/stories, scrolling, and partner updates after background/resume.
Real iOS keyboard behavior cannot be established by desktop viewport simulation alone.

## Rules Review and Deployment

No rules, functions or Vercel deployment was performed. Before saving real moments,
review and deploy both rule files, then deploy the app through your normal Vercel flow:

```sh
firebase deploy --only firestore:rules,storage
```

Storage now checks its parent Firestore document. Firebase may ask to enable the
cross-service rules permission during the first deployment; permit that integration
for this project. See [Firebase cross-service Storage rule reference](https://firebase.google.com/docs/reference/security/storage#firestoreget).
Object replacement is denied with both an update rule and an explicit `resource == null`
create guard, following [Firebase's immutable-object guidance](https://firebase.google.com/docs/reference/security/storage).

I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure for the two allowlisted UIDs in the yushef wedding collection, with immutable authorship, typed bounded fields, scoped photos, and personal-note ownership. However, you should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules.

Targeted audit of the new wedding rules (not a whole-project security certification):

```json
{
  "score": 5,
  "summary": "Wedding-only emulator tests reject unauthenticated and unauthorized access, wrong scopes, identity changes, partner-note edits, schema and capacity bypasses, foreign file paths, and uploads during cleanup. Both intended collaborators can complete the workflow.",
  "findings": []
}
```
