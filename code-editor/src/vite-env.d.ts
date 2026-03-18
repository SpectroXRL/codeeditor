/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_JUDGE0_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
