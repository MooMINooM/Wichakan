-- Match deployed Wichakan Supabase security migration.
-- Only database triggers should invoke this function; it is not a public RPC.
revoke execute on function private.log_enrollment_change() from public, anon, authenticated;
