/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /**
   * Origin of the voice companion backend, e.g. https://voice.example.org.
   * It holds an open WebSocket for the length of a conversation, which a
   * Vercel serverless function cannot do, so it is a separate deployment and
   * this is how the browser finds it. Unset means the feature is off and says
   * so, rather than offering a microphone button that cannot connect.
   */
  readonly VITE_VOICE_BACKEND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Short commit of the deployed build, injected by vite.config.ts. */
declare const __BUILD_ID__: string;
