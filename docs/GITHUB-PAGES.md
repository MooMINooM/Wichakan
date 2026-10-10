# Wichakan on GitHub Pages

Expected site after successful deployment and Pages activation:
https://moominoom.github.io/Wichakan/

## One-time GitHub configuration
1. In GitHub repository Settings > Pages select **GitHub Actions** as Build and deployment source.
2. In Settings > Secrets and variables > Actions > **Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://itmgezrxnqttngsmgxlo.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the enabled *publishable/anon* API key from Supabase Project Settings > API Keys.
3. Go to Actions > Deploy Wichakan to GitHub Pages > Run workflow if needed.
4. In Supabase Authentication > URL Configuration, set Site URL and/or Redirect URLs to your deployed URL as required by your Auth flow. Email/password sign-in in the current prototype does not send a magic link.
5. Test login, school membership, student listing, and log out using fictitious records.

GitHub Pages serves a statically exported Next.js app, not an application server. Browser Supabase calls rely on RLS. Any future sensitive server operations need a separate secure backend.

DO NOT add service_role, secret keys, real student data, or passwords to GitHub variables, client code or the repository.
Never assume the URL is live merely because the workflow file exists: enable Pages and check the Actions deployment run.
