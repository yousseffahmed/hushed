# Firebase setup for yushef

1. Create a Firebase project.
2. Add a Web app in Firebase project settings.
3. Copy the Firebase web config values into `.env.local` using `.env.example` as the template.
4. In Firebase Authentication, enable Email/Password sign-in.
5. Create exactly two users in Authentication.
6. Copy their Firebase Auth UIDs into:
   - `src/lib/coupleConfig.ts`
   - `firestore.rules`
   - `storage.rules`
7. Publish `firestore.rules` and `storage.rules` in Firebase.
8. Restart the Next.js dev server after changing `.env.local`.

The app signs in with email/password, then uses the authenticated UID for Firestore reads/writes and Storage uploads.
