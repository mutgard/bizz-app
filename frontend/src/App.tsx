import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import type { Client } from './types';
import { T } from './tokens';
import { useIsMobile } from './hooks/useIsMobile';
import { TopBar } from './components/TopBar';
import { BottomTabBar } from './components/BottomTabBar';
import { MobileHeader } from './components/MobileShell';
import { ClientsScreen } from './screens/ClientsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { TodayScreen } from './screens/TodayScreen';
import { MaterialsScreen } from './screens/MaterialsScreen';
import { NewClientScreen } from './screens/NewClientScreen';
import { RoadmapScreen } from './screens/RoadmapScreen';
import { InboxScreen } from './screens/InboxScreen';
import { FinancesScreen } from './screens/FinancesScreen';
import { api } from './api';
import { BriefPage } from './pages/BriefPage';
import { AdminPage } from './pages/AdminPage';
import { featureOn } from './config';
import { pathForScreen, screenForPath } from './routes';

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
  const navigate = useNavigate();
  const location = useLocation();
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

  const active = screenForPath(location.pathname);
  const nav = (s: string) => { setCreating(false); navigate(pathForScreen(s)); };
  const openClient = (id: number) => navigate(`/clients/${id}`);

  const handleCreateSuccess = (id: number) => {
    setCreating(false);
    refresh().then(() => openClient(id));
  };

  const routes = (
    <Routes>
      <Route path="/" element={<TodayScreen clients={clients} onOpenClient={openClient} onRefresh={refresh} />} />
      <Route path="/clients" element={<>
        {!creating && <ClientsScreen clients={clients} onOpen={openClient} onCreate={() => setCreating(true)} />}
        {creating && mobile && <NewClientScreen onCancel={() => setCreating(false)} onSuccess={handleCreateSuccess} />}
      </>} />
      <Route path="/clients/:id" element={<ProfileRoute clients={clients} onRefresh={refresh} onOpenFabrics={() => nav('fabrics')} />} />
      {featureOn('fabrics') && <Route path="/materials" element={<MaterialsScreen clients={clients} onRefresh={refresh} />} />}
      <Route path="/agenda" element={<RoadmapScreen clients={clients} onRefresh={refresh} />} />
      {featureOn('intake') && (
        <Route path="/intake" element={
          <InboxScreen
            onClientCreated={(id) => refresh().then(() => openClient(id))}
            onOpenClient={openClient}
          />
        } />
      )}
      <Route path="/caixa" element={<FinancesScreen clients={clients} onOpen={openClient} />} />
      <Route path="*" element={<Navigate to="/clients" replace />} />
    </Routes>
  );

  if (mobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100dvh', background: T.paper, color: T.ink, fontFamily: T.sans }}>
        <MobileHeader />
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>{routes}</div>
        <BottomTabBar active={active} onNav={nav} counts={counts} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: T.paper, color: T.ink, fontFamily: T.sans }}>
      <TopBar active={active} onNav={nav} counts={counts} onNewClient={() => setCreating(true)} clients={clients} onOpenClient={openClient} />
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>{routes}</div>
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

function ProfileRoute({ clients, onRefresh, onOpenFabrics }: {
  clients: Client[];
  onRefresh: () => Promise<void>;
  onOpenFabrics: () => void;
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const client = clients.find(c => c.id === Number(id));
  if (!clients.length) return null;              // still loading
  if (!client) return <Navigate to="/clients" replace />;
  return (
    <ProfileScreen
      client={client}
      onBack={() => navigate('/clients')}
      onOpenFabrics={onOpenFabrics}
      onRefresh={onRefresh}
      allClients={clients}
    />
  );
}
