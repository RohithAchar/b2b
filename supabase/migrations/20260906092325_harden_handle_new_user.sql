-- handle_new_user() is a trigger-only function (fires on auth.users insert).
-- It must not be callable via the Data API (/rest/v1/rpc/handle_new_user).
-- Revoking EXECUTE does not affect the trigger: the insert into auth.users is
-- performed by the Auth service role, not by anon/authenticated.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
