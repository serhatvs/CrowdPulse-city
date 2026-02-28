/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_CLOSE_MIN_VOTES?: string;
  readonly VITE_CONTRACT_ADDRESS?: string;
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_MONAD_CHAIN_ID?: string;
  readonly VITE_MONAD_CHAIN_NAME?: string;
  readonly VITE_MONAD_CURRENCY_NAME?: string;
  readonly VITE_MONAD_CURRENCY_SYMBOL?: string;
  readonly VITE_MONAD_EXPLORER_URL?: string;
  readonly VITE_MONAD_REQUIRED?: string;
  readonly VITE_MONAD_RPC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
