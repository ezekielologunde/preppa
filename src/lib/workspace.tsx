import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';

export type Workspace = 'customer' | 'kitchen';

const KEY = 'preppa.workspace.v1';

interface WorkspaceContextValue {
  workspace: Workspace;
  switchWorkspace: (w: Workspace) => void;
  canUseKitchen: boolean;
  prepperId: string | null;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspace: 'customer',
  switchWorkspace: () => {},
  canUseKitchen: false,
  prepperId: null,
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { data: prepper } = useMyPrepperApplication(user?.id);
  const isApprovedPrepper = prepper?.status === 'approved';

  const [workspace, setWorkspace] = useState<Workspace>('customer');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((val) => {
      if (val === 'kitchen') setWorkspace('kitchen');
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isApprovedPrepper && workspace === 'kitchen') {
      setWorkspace('customer');
      AsyncStorage.setItem(KEY, 'customer').catch(() => {});
    }
  }, [isApprovedPrepper, workspace]);

  function switchWorkspace(w: Workspace) {
    if (w === 'kitchen' && !isApprovedPrepper) return;
    setWorkspace(w);
    AsyncStorage.setItem(KEY, w).catch(() => {});
  }

  return (
    <WorkspaceContext.Provider value={{
      workspace,
      switchWorkspace,
      canUseKitchen: isApprovedPrepper,
      prepperId: prepper?.id ?? null,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
