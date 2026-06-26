// js/supabase-config.js

// Retrieve these from your Supabase Dashboard -> Project Settings -> API
const SUPABASE_URL = 'https://gjdczaceodcnhsqeorsk.supabase.co'; // ✨ Clean base URL!
const SUPABASE_ANON_KEY = 'sb_publishable_7qGFbwDQokWf05q8SIq_3Q_04SQnr2h';      

// Initialize using the global script window object from index.html
window.supabaseClientInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);