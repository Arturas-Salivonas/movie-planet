/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  readonly VITE_PUBLIC_URL: string
  readonly VITE_DEFAULT_LAT: string
  readonly VITE_DEFAULT_LNG: string
  readonly VITE_DEFAULT_ZOOM: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
