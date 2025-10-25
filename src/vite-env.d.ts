// FIX: Updated to include VITE_GEMINI_API_KEY environment variable.
interface ImportMetaEnv {
  // Environment variables defined here are available via `import.meta.env`
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
