// js/supabase-config.js

// 1. Assign your exact credentials to clean, constant strings
const SUPABASE_URL = 'https://gjdczaceodcnhsqeorsk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7qGFbwDQokWf05q8SIq_3Q_04SQnr2h';

// 2. Safely initialize the global Supabase client object instance
const supabaseClientInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 3. Bind it directly to the browser window scope for app.js and calendar.js to consume
window.supabaseClientInstance = supabaseClientInstance;