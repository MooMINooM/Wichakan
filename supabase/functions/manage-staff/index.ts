import {createClient} from '@supabase/supabase-js';
import {createStaffHandler} from './handler.ts';

const url=Deno.env.get('SUPABASE_URL')!;
const anonKey=Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const options={auth:{persistSession:false,autoRefreshToken:false}};
// Gateway JWT checking is disabled for modern signing-key compatibility. Every
// request is authenticated with getUser and authorized against live memberships.
Deno.serve(createStaffHandler({
 userClient:(token:string)=>createClient(url,anonKey,{...options,global:{headers:{Authorization:'Bearer '+token}}}),
 adminClient:()=>createClient(url,serviceKey,options),
 origins:(Deno.env.get('STAFF_ALLOWED_ORIGINS')??'https://moominoom.github.io,http://localhost:3000,http://127.0.0.1:3000').split(',').map(s=>s.trim()).filter(Boolean),
}));
