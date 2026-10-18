# Phase 1 black-box test

Phase 1 connects the signed-in workflow to Oracle for users, patient profiles, manually entered insurance, and provider listings. Insurance card upload remains UI-only.

## Connected database

1. Configure `.env.local`, then run `npm run db:migrate` and `npm run db:verify`.
2. Run `npm run dev`, open `http://localhost:3000`, and sign in with Google.
3. Confirm the green **Oracle connected** status appears.
4. Complete onboarding with a valid name, 10-digit phone, date of birth, ZIP, language, and payment choice.
5. If using insurance, type the insurer, member ID, and plan name manually. Selecting upload files should only show their names; it must not extract or persist the files.
6. Finish setup and confirm the app opens the home page.
7. Open **Profile & insurance**, change a personal field, and select **Save details**. Confirm **Profile saved to Oracle.** appears.
8. Save insurance and confirm **Insurance saved to Oracle.** appears.
9. Refresh the browser or sign out and back in. Confirm the saved profile and insurance values return.
10. Open appointment results for a dental visit. Confirm provider names and prices match the seeded Oracle provider catalog.
11. Remove insurance, refresh, and confirm the insurance fields remain empty.

## Disconnected development fallback

1. Stop Oracle access temporarily (for example, set an invalid `ORACLE_CONNECT_STRING`) and restart the dev server.
2. Sign in and confirm the yellow **Development data — database disconnected** banner appears.
3. Confirm sample profile/provider data keeps the UI usable.
4. Change and save a field. Confirm the status explicitly says it was saved for this session only.
5. Refresh the page and confirm the fallback changes do not persist.
6. Restore the correct Oracle setting, restart the server, and select **Retry database**. Confirm the status changes to **Oracle connected** and Oracle data replaces the fixtures.
