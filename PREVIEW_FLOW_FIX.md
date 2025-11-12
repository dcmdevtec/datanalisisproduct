Preview flow fixes and audit log

Why these changes
- The preview flow sometimes opened `/preview/survey` (without a surveyId) which prevented server-side or route-based behaviour tied to a survey id.
- Editor's Preview button now creates a draft survey and attempts to open `/preview/survey/{surveyId}`. If that route wasn't present in the app router, the browser showed a 404.

What I changed
1. Added a dynamic preview route so `/preview/survey/{id}` resolves to the preview page.
   - File added: `app/preview/survey/[id]/page.tsx`
   - This file loads the existing client preview component and ensures it receives the surveyId via the path.
2. Documented the changes in this file for traceability.

How to test
1. In the editor (Create / Edit survey), click "Vista Previa". The editor will create a draft if needed and open the preview URL. If the draft creation succeeds, you should see `/preview/survey/{surveyId}` open without 404.
2. On the preview page the verification modal should appear if `localStorage.respondent_public_id_{surveyId}` is missing.

How to revert
- Remove `app/preview/survey/[id]/page.tsx` and restore earlier version of `app/projects/[id]/create-survey/page.tsx` from git.

Notes
- I intentionally didn't modify other routes. If you prefer a different flow (preview without creating a draft), tell me and I'll adjust.

If you want, I can now implement the final step: include `respondent_public_id` on the response POST from the preview page so completed responses are tracked automatically. Reply "include respondent_public_id" to proceed.