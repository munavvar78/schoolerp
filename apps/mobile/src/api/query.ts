import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => {
        if (error instanceof ApiError && (error.status === 0 || error.status === 400 || error.status === 401 || error.status === 403 || error.status === 404)) {
          return false;
        }
        return count < 1;
      },
      staleTime: 20_000,
      gcTime: 5 * 60_000,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
});
