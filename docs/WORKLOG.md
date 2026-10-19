

## 2026-10-19 follow-up

- Rechecked live Supabase connection and advisors. The database currently reports 9 properties, 21 owner records, 41 user records, and 5 visit requests; these are inventory counts only and do not imply data validity.
- Security advisor still flags anonymous execution of `get_public_properties`, `get_nearby_properties`, and `verify_my_login_phone`, plus authenticated execution of SECURITY DEFINER functions. Each function's authorization intent must be reviewed individually; do not revoke admin RPCs indiscriminately.
- The public inventory RPC definitions include pending listings and return `owner_id`. A proposed correction was not applied because the write action was blocked; production SQL remains unchanged.
- No production migration, merge to `main`, or deployment was performed in this follow-up. End-to-end browser tests and a verified recoverable backup remain uncompleted.
