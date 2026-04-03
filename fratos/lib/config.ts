export const CONFIG = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://your-project.supabase.co",
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "your-anon-key",
  API_BASE: process.env.NEXT_PUBLIC_API_BASE || "",
  USE_MOCKS: process.env.NEXT_PUBLIC_USE_MOCKS === "true",
};
