import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { AuthError, irAAcceso } from './client'

export const contabilidadKeys = {
  all: ['contabilidad'] as const,
  movimientos: ['contabilidad', 'movimientos'] as const,
  metas: ['contabilidad', 'metas'] as const,
  config: ['contabilidad', 'config'] as const,
}

function onAuthError(err: unknown) {
  if (err instanceof AuthError) irAAcceso()
}

export function createContabilidadQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: onAuthError,
    }),
    mutationCache: new MutationCache({
      onError: onAuthError,
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, err) => {
          if (err instanceof AuthError) return false
          return count < 1
        },
      },
      mutations: {
        retry: false,
      },
    },
  })
}
