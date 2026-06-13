import { Fragment, useEffect, useMemo, useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import {
  CheckEmailPage,
  ForgotPasswordPage,
  MagicSignInPage,
  PasswordSignInPage,
  RegisterPage,
  ResetPasswordPage,
  SignInPage,
  VerifyEmailPage,
} from './features/auth/AuthPages';
import { OnboardingPage } from './features/onboarding/OnboardingPage';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import type { HeaderBreadcrumb } from './components/layout/Header';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { FulfillmentPage } from './features/fulfillment/FulfillmentPage';
import { ResourcesPage } from './features/resources/ResourcePage';
import { ResourceCreatePage } from './features/resources/ResourceCreatePage';
import { ResourceDetailPage } from './features/resources/ResourceDetailPage';
import { ResourceEditPage } from './features/resources/ResourceEditPage';
import { OffersPage } from './features/offers/OffersPage';
import { OfferCreatePage } from './features/offers/OfferCreatePage';
import { AvailabilityPage } from './features/availability/AvailabilityPage';
import { PricingPage } from './features/pricing/PricingPage';
import { PayoutsPage } from './features/payouts/PayoutsPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { SettingsPage } from './features/settings/SettingsPage';

type PageConfig = { title: string; subtitle?: string; breadcrumbs?: HeaderBreadcrumb[] };

const pageConfig: Record<string, PageConfig> = {
  '/': { title: 'Дашборд', subtitle: 'Обзор партнера' },
  '/fulfillment': { title: 'Выдача и возврат', subtitle: 'Выдачи, возвраты и обращения' },
  '/resources': { title: 'Каталог', subtitle: 'Прокатные позиции, модели и инвентарь' },
  '/resources/create': { title: 'Добавить позицию', subtitle: 'Добавьте позицию в каталог.' },
  '/offers': { title: 'Предложения', subtitle: 'Пакеты и условия проката для клиентов' },
  '/availability': { title: 'Доступность', subtitle: 'Горизонты бронирования и вместимость' },
  '/pricing': { title: 'Цены', subtitle: 'Правила ценообразования и корректировки' },
  '/payouts': { title: 'Выплаты', subtitle: 'Договоры и статус настройки выплат' },
  '/settings': { title: '' },
  '/settings/profile': { title: '' },
  '/settings/shop': { title: '' },
  '/settings/locations': { title: '' },
  '/settings/employees': { title: '' },
  '/settings/account': { title: '' },
  '/locations': { title: '' },
  '/reports': { title: 'Отчеты', subtitle: 'Показатели и аналитика' },
};

type HeaderContent = PageConfig | null;

function AppShell() {
  const { user, memberships, loading } = useAuth();
  const knownPaths = useMemo(() => new Set(Object.keys(pageConfig)), []);
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname || '/');
  const [navigationReloadKey, setNavigationReloadKey] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [headerContent, setHeaderContent] = useState<HeaderContent>(null);
  const params = new URLSearchParams(window.location.search);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname || '/');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string, replace = false) => {
    if (replace) {
      window.history.replaceState(null, '', path);
    } else {
      window.history.pushState(null, '', path);
    }
    setCurrentPath(window.location.pathname || '/');
  };

  const navigateTo = (nextPath: string) => {
    const safePath = knownPaths.has(nextPath) || nextPath.startsWith('/resources/') ? nextPath : '/';
    if (window.location.pathname !== safePath || window.location.search !== '') {
      window.history.pushState({}, '', safePath);
    }
    setCurrentPath(safePath);
    setNavigationReloadKey(key => key + 1);
  };

  useEffect(() => {
    if (!loading && user && user.emailVerified !== false && memberships.length === 0 && currentPath !== '/onboarding') {
      navigate('/onboarding', true);
    }
  }, [currentPath, loading, memberships.length, user]);

  useEffect(() => {
    if (!loading && user && user.emailVerified !== false && memberships.length > 0 && currentPath === '/onboarding') {
      navigate('/', true);
    }
  }, [currentPath, loading, memberships.length, user]);

  const renderAuthPage = () => {
    if (currentPath === '/auth/register') return <RegisterPage token={params.get('token')} onNavigate={navigate} />;
    if (currentPath === '/auth/password-sign-in') return <PasswordSignInPage initialEmail={params.get('email') ?? ''} onNavigate={navigate} />;
    if (currentPath === '/auth/magic-sign-in') return <MagicSignInPage token={params.get('token')} onNavigate={navigate} />;
    if (currentPath === '/auth/check-email') return <CheckEmailPage email={params.get('email') ?? user?.email ?? ''} onNavigate={navigate} />;
    if (currentPath === '/auth/verify-email' || currentPath === '/auth/verify-mail') return <VerifyEmailPage token={params.get('token')} onNavigate={navigate} />;
    if (currentPath === '/auth/forgot-password') return <ForgotPasswordPage initialEmail={params.get('email') ?? ''} onNavigate={navigate} />;
    if (currentPath === '/auth/reset-password') return <ResetPasswordPage token={params.get('token')} onNavigate={navigate} />;
    return <SignInPage onNavigate={navigate} />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (currentPath.startsWith('/auth')) {
    return renderAuthPage();
  }

  if (!user) {
    return <SignInPage onNavigate={navigate} />;
  }

  if (user.emailVerified === false) {
    return <CheckEmailPage email={user.email} onNavigate={navigate} />;
  }

  if (currentPath === '/onboarding') {
    return <OnboardingPage />;
  }

  if (memberships.length === 0) {
    return <OnboardingPage />;
  }

  const pathnameOnly = currentPath.split('?')[0];
  const offerCreateMatch = pathnameOnly.match(/^\/resources\/([^/]+)\/offers\/new$/);
  const resourceDetailMatch = pathnameOnly.match(/^\/resources\/([^/]+)$/);
  const resourceEditMatch = pathnameOnly.match(/^\/resources\/([^/]+)\/edit$/);
  const appPath = knownPaths.has(pathnameOnly) || offerCreateMatch || resourceDetailMatch || resourceEditMatch ? pathnameOnly : '/';
  const page =
    offerCreateMatch ? { title: 'Создать предложение' } :
    resourceEditMatch ? { title: 'Редактировать позицию', subtitle: 'Изменение позиции инвентаря' } :
    resourceDetailMatch ? { title: 'Позиция' } :
    pageConfig[appPath] || { title: 'Кабинет партнера' };
  const headerPage = headerContent ?? page;
  const showHeader = !appPath.startsWith('/settings') && appPath !== '/locations';

  const renderPage = () => {
    if (appPath === '/') return <DashboardPage onNavigate={navigateTo} />;
    if (appPath === '/fulfillment') return <FulfillmentPage />;
    if (appPath === '/resources') return <ResourcesPage onHeaderContentChange={setHeaderContent} onNavigate={navigateTo} />;
    if (appPath === '/resources/create') return <ResourceCreatePage onNavigate={navigateTo} onHeaderContentChange={setHeaderContent} />;
    if (offerCreateMatch) return <OfferCreatePage resourceId={offerCreateMatch[1]} onNavigate={navigateTo} onHeaderContentChange={setHeaderContent} />;
    if (resourceEditMatch) return <ResourceEditPage resourceId={resourceEditMatch[1]} onNavigate={navigateTo} onHeaderContentChange={setHeaderContent} />;
    if (resourceDetailMatch) return <ResourceDetailPage resourceId={resourceDetailMatch[1]} onNavigate={navigateTo} onHeaderContentChange={setHeaderContent} />;
    if (appPath === '/offers') return <OffersPage />;
    if (appPath === '/availability') return <AvailabilityPage onNavigate={navigateTo} />;
    if (appPath === '/pricing') return <PricingPage onNavigate={navigateTo} />;
    if (appPath === '/payouts') return <PayoutsPage />;
    if (appPath === '/settings' || appPath === '/settings/account') return <SettingsPage tab="account" onNavigate={navigateTo} />;
    if (appPath === '/settings/profile' || appPath === '/settings/shop') return <SettingsPage tab="shop" onNavigate={navigateTo} />;
    if (appPath === '/settings/locations' || appPath === '/locations') return <SettingsPage tab="locations" onNavigate={navigateTo} />;
    if (appPath === '/settings/employees') return <SettingsPage tab="employees" onNavigate={navigateTo} />;
    if (appPath === '/reports') return <ReportsPage />;
    return <DashboardPage onNavigate={navigateTo} />;
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {showHeader && (
        <Header
          title={headerPage.title}
          subtitle={headerPage.subtitle}
          breadcrumbs={headerPage.breadcrumbs}
          onNavigate={navigateTo}
        />
      )}
      <div className="flex min-h-0 min-w-0 flex-1">
        <Sidebar
          currentPath={appPath}
          onNavigate={navigateTo}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        />
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-muted/30">
          <main className="relative min-h-0 flex-1 overflow-y-auto">
            <Fragment key={`${appPath}:${navigationReloadKey}`}>
              {renderPage()}
            </Fragment>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
