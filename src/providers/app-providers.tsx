import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '@/lib/query-client';
import { WorkspaceProvider } from '@/lib/workspace';
import { AuthProvider } from '@/providers/auth-provider';
import { LocationProvider } from '@/providers/location-provider';

/** Composes the cross-cutting providers every screen depends on. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <WorkspaceProvider>
              <LocationProvider>{children}</LocationProvider>
            </WorkspaceProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
