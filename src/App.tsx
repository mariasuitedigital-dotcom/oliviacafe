import React, { useMemo } from 'react';
import { AuthProvider, useAuth } from '@/src/shared/auth/AuthContext';
import { ThemeProvider } from '@/src/shared/theme/ThemeProvider';
import { PortalAccesoView } from '@/src/shared/components/PortalAccesoView';
import ClientApp from '@/src/apps/client/ClientApp';
import PosApp from '@/src/apps/pos/PosApp';
import AdminApp from '@/src/apps/admin/AdminApp';

const SingleProfileGateway: React.FC = () => {
  const { role, clientSession, posSession, ownerDemoSession } = useAuth();

  const resolvedRole = useMemo(() => {
    if (role === 'owner' || role === 'superadmin' || ownerDemoSession) return 'owner';
    if (role === 'cashier' || posSession) return 'cashier';
    if (role === 'customer' || clientSession) return 'customer';
    return null;
  }, [role, ownerDemoSession, posSession, clientSession]);

  if (resolvedRole === 'owner') return <AdminApp withAuthProvider={false} />;
  if (resolvedRole === 'cashier') return <PosApp withAuthProvider={false} />;
  if (resolvedRole === 'customer') return <ClientApp withAuthProvider={false} />;

  return <PortalAccesoView />;
};

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider negocioSlug="olivia">
        <SingleProfileGateway />
      </ThemeProvider>
    </AuthProvider>
  );
}
