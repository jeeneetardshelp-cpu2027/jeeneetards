# Legal release inputs

The owner must supply and approve each fact below before the Terms and Privacy
pages are treated as launch-ready. Engineering must not infer these details
from an account name, email address, repository, or hosting configuration.

Status: values supplied by the owner on 25 July 2026 and wired into the Terms
and Privacy pages. **A qualified legal/privacy review is still outstanding
before public launch** (see the note at the end of this file).

1. **Legal entity or individual operator name — Supplied:** Amit
   - Provide the exact public legal name of the person, company, trust, or
     organisation responsible for the service. (Owner note: a fuller legal name
     may be advisable on legal advice.)
2. **Contact email — Supplied:** jeeneetardshelp@gmail.com
   - Provide the monitored public address for privacy requests, support,
     corrections, and rights-holder notices.
3. **Postal address and jurisdiction — Supplied:** Jaipur, Rajasthan, India;
   governed by the laws of India; disputes subject to the courts of Jaipur,
   Rajasthan.
   - A full street postal address was not provided; confirm on legal advice
     whether one must be published.
4. **Hosting provider — Supplied:** Vercel, Supabase, YouTube, and Google are
   named publicly in the Privacy Policy.
5. **Effective date — Supplied:** 25 July 2026

Additional owner decisions that must accompany legal review:

- Retention periods for account, rating, review, report, support, and
  operational-log data.
- The process for access, correction, deletion, withdrawal, and rights-holder
  requests.
- The policy and consent model for students under 18.
- Whether accounts, ratings, reviews, and reports will be enabled at launch.
- Whether advertising or audience analytics will be added.

This checklist is an engineering release control, not legal advice. The final
public text should receive qualified legal and privacy review for the markets
and ages the service will support.

## 2026-07-30 addendum: accounts and ratings enabled

The owner was asked directly whether to proceed with public student accounts
and rating submission given that the under-18 consent/age-assurance question
above had not yet had a qualified legal review, and chose to proceed and
accept that risk. `studentAccounts` and `courseRatingSubmission` in
`src/releaseCapabilities.js` were changed to `true` on this basis.
`contentReporting` was left disabled — it is a separate decision and there is
still no moderation path for reported content.

This is a record of the decision the owner made, not a substitute for the
qualified legal/privacy review still recommended above.
