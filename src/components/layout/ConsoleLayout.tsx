import { Fragment, useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { selectProvider, useSelectedProviderId } from '../../lib/active-provider';
import { ProviderContextProvider } from '../../features/providers/ProviderContext';
import { statusMeta } from '../../features/providers/providerStatus';
import { Header } from './Header';
import { PageHeading, type PageBreadcrumb } from './PageHeading';

export type PageConfig = { title: string; subtitle?: string; breadcrumbs?: PageBreadcrumb[] };

// Page names for the content column. Keyed by the console-relative path.
const pageConfig: Record<string, PageConfig> = {
  '/': { title: '' },
  '/fulfillment': { title: 'Выдача и возврат', subtitle: 'Выдачи, возвраты и обращения' },
  '/resources': { title: 'Каталог', subtitle: 'Прокатные позиции, модели и инвентарь' },
  '/resources/create': { title: 'Добавить позицию', subtitle: 'Добавьте позицию в каталог.' },
  '/offers': { title: 'Предложения', subtitle: 'Пакеты и условия проката для клиентов' },
  // The settings section draws its own tab bar, so it asks the header for no title row.
  '/settings/shop': { title: '' },
  '/settings/seller': { title: '' },
  '/settings/locations': { title: '' },
  '/settings/employees': { title: '' },
  '/settings/payouts': { title: '' },
  '/settings/contracts': { title: '' },
  '/settings/account': { title: '' },
};

function pageFor(relativePath: string): PageConfig {
  if (/^\/resources\/[^/]+\/offers\/new$/.test(relativePath)) return { title: 'Создать предложение' };
  if (/^\/resources\/[^/]+\/edit$/.test(relativePath)) return { title: 'Редактировать позицию', subtitle: 'Изменение позиции инвентаря' };
  if (/^\/resources\/[^/]+$/.test(relativePath)) return { title: 'Позиция' };
  return pageConfig[relativePath] ?? { title: '' };
}

/**
 * The console. The cabinet is whichever one this device selected (see active-provider.ts); a
 * selection the session does not know, or none at all, sends the person to the picker. A person
 * with exactly one cabinet never sees the picker: it is selected for them.
 */
export function ConsoleLayout() {
  const selectedId = useSelectedProviderId();
  const { providers, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [headerContent, setHeaderContent] = useState<PageConfig | null>(null);

  const provider = useMemo(() => {
    const chosen = providers.find(item => item.providerId === selectedId);
    return chosen ?? (providers.length === 1 ? providers[0] : null);
  }, [providers, selectedId]);
  const relativePath = location.pathname || '/';

  // The selection must be in place before a page's first render, not after it: pages load their
  // data in effects, and children's effects run before this layout's would.
  if (provider && provider.providerId !== selectedId) selectProvider(provider.providerId);

  useEffect(() => {
    setHeaderContent(null);
  }, [relativePath]);

  if (loading) return null;
  if (!provider) {
    return <Navigate to="/providers" replace />;
  }

  const navigateTo = (path: string) => navigate(path);

  const page = headerContent ?? pageFor(relativePath);
  const status = statusMeta(provider.status);
  const showStatusBanner = provider.status !== 'active' && relativePath !== '/';

  return (
    <ProviderContextProvider provider={provider}>
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <Header currentPath={relativePath} onNavigate={navigateTo} />
        <main className="relative min-h-0 flex-1 overflow-y-auto bg-background">
          <div className="mx-auto flex h-full w-full max-w-screen-xl flex-col">
            {showStatusBanner && (
              <div className="mx-6 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <span>
                  <span className="font-semibold">{status.label}.</span> {status.hint}
                </span>
                <button type="button" onClick={() => navigateTo('/')} className="font-medium text-blue-700 hover:underline">
                  К чек-листу
                </button>
              </div>
            )}
            <PageHeading title={page.title} subtitle={page.subtitle} breadcrumbs={page.breadcrumbs} onNavigate={navigateTo} />
            <Fragment key={relativePath}>
              <Outlet context={{ navigateTo, setHeaderContent } satisfies ConsoleOutletContext} />
            </Fragment>
          </div>
        </main>
      </div>
    </ProviderContextProvider>
  );
}

export type ConsoleOutletContext = {
  navigateTo: (path: string) => void;
  setHeaderContent: (content: PageConfig | null) => void;
};
