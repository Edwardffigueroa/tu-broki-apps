import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { AuthError, irAAcceso } from './client'

export const diagramasKeys = {
  all: ['diagramas'] as const,
  lists: () => [...diagramasKeys.all, 'list'] as const,
  list: (params: {
    q: string
    grupo: string | null
    etiqueta: string | null
    archivados: boolean
  }) => [...diagramasKeys.lists(), params] as const,
  grupos: () => [...diagramasKeys.all, 'grupos'] as const,
  etiquetas: () => [...diagramasKeys.all, 'etiquetas'] as const,
  detail: (id: string) => [...diagramasKeys.all, 'detail', id] as const,
}

function onAuthError(err: unknown) {
  if (err instanceof AuthError) irAAcceso()
}

export function createDiagramasQueryClient() {
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
