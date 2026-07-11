import { useState, useEffect } from 'react';
import type { Client } from './types';
import { T } from './tokens';
import { useIsMobile } from './hooks/useIsMobile';
import { Sidebar } from './components/Sidebar';
import { MobileHeader } from './components/MobileShell';
import { ClientsScreen } from './screens/ClientsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { FabricsScreen } from './screens/FabricsScreen';
import { ShoppingScreen } from './screens/ShoppingScreen';
import { NewClientScreen } from './screens/NewClientScreen';
import { RoadmapScreen } from './screens/RoadmapScreen';
import { IntakeDemoScreen } from './screens/IntakeDemoScreen';
import { FinancesScreen } from './screens/FinancesScreen';
import { api } from './api';
import { BriefPage } from './pages/BriefPage';
import { AdminPage } from './pages/AdminPage';
import { featureOn } from './config';

type Screen = 'clients' | 'profile' | 'fabrics' | 'shop' | 'roadmap' | 'intake' | 'finances';

export default function App() {
  const pathname = window.location.pathname;
  if (pathname.startsWith('/brief/')) {
    const token = pathname.slice('/brief/'.length);
    return <BriefPage token={token} />;
  }
  if (pathname === '/admin') {
    return <AdminPage />;
  }
  return <AtelierApp />;
}

function AtelierApp() {
  const mobile = useIsMobile();
  const [screen, setScreen] = useState<Screen>('clients');
  const [clientId, setClientId] = useState<number | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [creating, setCreating] = useState(false);

  const refresh = () => api.listClients().then(setClients);

  useEffect(() => { refresh(); }, []);

  const fabricsToBuy = clients.flatMap(c => c.fabrics).filter(f => f.to_buy).length;
  const totalFabrics = clients.flatMap(c => c.fabrics).length;
  const counts: Record<string, number> = {
    totalClients: clients.length,
    totalFabrics,
    fabricsToBuy,
  };

  const nav = (s: string) => { setScreen(s as Screen); setCreating(false); if (s !== 'profile') setClientId(null); };
  const openClient = (id: number) => { setClientId(id); setScreen('profile'); };
  const back = () => { setScreen('clients'); setClientId(null); };

  const handleCreateSuccess = (id: number) => {
    setCreating(false);
    refresh().then(() => openClient(id));
  };

  const content = (
    <>
      {screen === 'clients' && !creating && <ClientsScreen clients={clients} onOpen={openClient} onCreate={() => setCreating(true)} />}
      {screen === 'clients' && creating && mobile && (
        <NewClientScreen onCancel={() => setCreating(false)} onSuccess={handleCreateSuccess} />
      )}
      {screen === 'profile' && clientId !== null && (
        <ProfileScreen
          client={clients.find(c => c.id === clientId) ?? clients[0]}
          onBack={back}
          onOpenFabrics={() => nav('fabrics')}
          onRefresh={refresh}
          allClients={clients}
        />
      )}
      {screen === 'fabrics'  && featureOn('fabrics')  && <FabricsScreen clients={clients} onRefresh={refresh} />}
      {screen === 'shop'     && featureOn('shopping') && <ShoppingScreen clients={clients} />}
      {screen === 'roadmap'  && <RoadmapScreen clients={clients} onRefresh={refresh} />}
      {screen === 'intake' && featureOn('intake') && (
        <IntakeDemoScreen
          onClientCreated={() => {
            refresh().then(() => nav('clients'));
          }}
        />
      )}
      {screen === 'finances' && (
        <FinancesScreen clients={clients} onOpen={openClient} />
      )}
    </>
  );

  if (mobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100dvh', background: T.paper, color: T.ink, fontFamily: T.sans }}>
        <MobileHeader active={screen} onNav={nav} counts={counts} />
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', paddingBottom: 'env(safe-area-inset-bottom)' }}>{content}</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '232px 1fr', width: '100%', height: '100%', background: T.paper, color: T.ink, fontFamily: T.sans }}>
      <Sidebar active={screen} onNav={nav} counts={counts} />
      <div style={{ minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>{content}</div>
      {creating && !mobile && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(42,31,20,0.45)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          padding: '48px 24px',
          overflowY: 'auto',
        }}>
          <div style={{
            width: 480,
            maxHeight: 'calc(100vh - 96px)',
            background: T.paper,
            boxShadow: '0 8px 48px rgba(0,0,0,0.28)',
            display: 'flex', flexDirection: 'column',
          }}>
            <NewClientScreen onCancel={() => setCreating(false)} onSuccess={handleCreateSuccess} />
          </div>
        </div>
      )}
    </div>
  );
}
