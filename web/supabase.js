'use strict';
// Supabase client + thin Auth helpers. The anon key is public by design — Row Level
// Security (see web/SUPABASE_SETUP.md) is what scopes every row to its owner.
const SB_URL = 'https://livhijcgkielwrkdqtbm.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpdmhpamNna2llbHdya2RxdGJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMjMwNTgsImV4cCI6MjA5Nzc5OTA1OH0.f6GY7rICjjR8J0iTGmXpDLWNnhv77bPaFVBx7ooN3MY';

const SB = supabase.createClient(SB_URL, SB_ANON);

const Auth = {
  async session() { const { data } = await SB.auth.getSession(); return data.session; },
  onChange(cb) { SB.auth.onAuthStateChange((_e, session) => cb(session)); },
  signUp(email, pw) { return SB.auth.signUp({ email, password: pw }); },
  signIn(email, pw) { return SB.auth.signInWithPassword({ email, password: pw }); },
  signInGoogle() { return SB.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } }); },
  signOut() { return SB.auth.signOut(); }
};
