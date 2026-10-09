import { Fragment, useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { selectProvider, useSelectedProviderId } from '../../lib/active-provider';
import { ProviderContextProvider } from '../../features/providers/ProviderContext';
import { statusMeta } from '../../features/providers/providerStatus';
import { Header, MobileNavBar } from './Header';
import { SubPageHeader } from './SubPageHeader';
import { WorkspaceContext, WORKSPACE_STORAGE_KEY, readWorkspace, type Workspace } from '../../features/workspace/workspace';
import { PageHeading, type PageBreadcrumb } from './PageHeading';
import { useGoBack } from '../../lib/useGoBack';

export type PageConfig = { title: string; subtitle?: string; breadcrumbs?: PageBreadcrumb[] };

// Page names for the content column. Keyed by the console-relative path.
const pageConfig: Record<string, PageConfig> = {
  '/': { title: '' },
  // Заказы draws its own heading, with the count in it, the way the catalogue does.
  '/bookings': { title: '' },
  '/scan': { title: '' },
  '/x': { title: '' },
  '/x/experiences': { title: '' },
  '/x/schedule': { title: '' },
  '/x/bookings': { title: '' },
  '/x/finances': { title: '' },
  '/menu': { title: '' },
  '/ratings': { title: '' },
  // The settings section draws its own tab bar, so it asks the header for no title row.
  '/settings/shop': { title: '' },
  '/settings/seller': { title: '' },
  '/settings/locations': { title: '' },
  '/settings/employees': { title: '' },
  '/settings/payouts': { title: '' },
  '/settings/contracts': { title: '' },
  '/settings/account': { title: '' },
};

/**
 * Routes that are a job rather than a place. On a phone these take the whole screen: a way back
 * and the name of the task in the header, and no section bar underneath, because the job is the
 * only thing on screen until it is done or abandoned.
 */
const SETTINGS_TITLES: Record<string, string> = {
  '/settings/shop': 'Профиль проката',
  '/settings/shop-edit': 'Профиль проката',
  '/settings/locations': 'Пункты проката',
  '/settings/employees': 'Сотрудники',
  '/settings/seller': 'Информация о продавце',
  '/settings/seller-edit': 'Данные продавца',
  '/settings/payouts': 'Реквизиты выплат',
  '/settings/contracts': 'Договоры',
  '/settings/account': 'Аккаунт',
};

const PAGE_TITLES: Record<string, string> = { '/ratings': 'Оценки' };

/**
 * Screens that are somewhere you went, rather than one of the sections you switch between.
 *
 * On a phone they get a bar with a way back and the name of where you are — the shape every phone
 * uses for a page opened from a list. `hideNav` separates the two kinds: a settings page is still
 * inside the console and keeps the section bar, while writing a card takes the whole screen, since
 * offering «Каталог» halfway through is offering to throw the draft away.
 */
function taskFor(relativePath: string): {
  title: string;
  backTo: string;
  hideNav: boolean;
  help?: string;
  /** The page draws its own bar, because it has something of its own to put in the corner. */
  bare?: boolean;
} | null {
  // The viewfinder is the page: a bar to leave by and the camera under it, nothing across it.
  if (relativePath === '/scan') {
    return { title: 'Сканер', backTo: '/', hideNav: true };
  }
  if (relativePath === '/products/new') return { title: 'Новый товар', backTo: '/products', hideNav: true };
  // Picking cards: its own bar, with the count and «выбрать все» in the corner.
  if (relativePath === '/products/select') {
    return { title: 'Выбор товаров', backTo: '/products', hideNav: true, bare: true };
  }
  if (relativePath === '/bookings/filters') {
    return { title: 'Фильтры', backTo: '/bookings', hideNav: true };
  }
  if (relativePath === '/bookings/calendar') {
    return {
      title: 'Календарь',
      backTo: '/bookings',
      hideNav: true,
      help: 'Выберите день, чтобы увидеть выдачи и возвраты на него. Точки под числом — это брони: '
        + 'синяя значит выдачу, бирюзовая возврат.',
    };
  }
  // A booking's own page: its bar carries the number and a menu for it, so the page draws it.
  if (/^\/bookings\/[^/]+$/.test(relativePath)) {
    return { title: 'Бронирование', backTo: '/bookings', hideNav: true, bare: true };
  }
  if (relativePath === '/products/filters') {
    return { title: 'Фильтры', backTo: '/products', hideNav: true };
  }
  // A group's own page: the bar carries the group's name and a menu for it, so the page draws it.
  if (relativePath.startsWith('/products/groups/')) {
    return { title: 'Группа', backTo: '/products/groups', hideNav: true, bare: true };
  }
  if (relativePath === '/products/groups') {
    return {
      title: 'Группы товаров',
      backTo: '/products',
      hideNav: true,
      help: 'Товары с одинаковым названием группы покупатель видит как одну карточку с выбором — '
        + 'например, один велосипед в трёх размерах рамы. Название группы задаётся в карточке товара: '
        + 'совпало — товары в одной группе.',
    };
  }
  const editing = relativePath.match(/^\/products\/([^/]+)\/edit$/);
  if (editing) return { title: 'Редактирование', backTo: `/products/${editing[1]}`, hideNav: true };
  // A card's own page: its bar carries the card's name and a menu for it, so the page draws it.
  if (/^\/products\/[^/]+$/.test(relativePath)) {
    return { title: 'Товар', backTo: '/products', hideNav: true, bare: true };
  }

  const plain = PAGE_TITLES[relativePath];
  if (plain) return { title: plain, backTo: '/', hideNav: false };

  const settings = SETTINGS_TITLES[relativePath];
  if (settings) {
    // An edit screen goes back to what it edits; a section goes back to the menu it came from.
    const parent = relativePath.endsWith('-edit') ? relativePath.replace('-edit', '') : '/menu';
    return { title: settings, backTo: parent, hideNav: relativePath.endsWith('-edit') };
  }
  return null;
}

function pageFor(relativePath: string): PageConfig {
  // Product pages carry their own headings, breadcrumb included.
  if (relativePath.startsWith('/products')) return { title: '' };
  return pageConfig[relativePath] ?? { title: '' };
}

/**
 * The console. The cabinet is whichever one this device selected (see active-provider.ts); a
 * selection the session does not know, or none at all, sends the person to the picker. A person
 * with exactly one cabinet never sees the picker: it is selected for them.
 */
export function ConsoleLayout() {
  // Which business this cabinet is being used for right now. Persisted, because a seller who runs
  // both does not want to re-choose on every visit.
  const [workspace, setWorkspaceState] = useState<Workspace>(readWorkspace);
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
  // Read before the early returns below, because a hook cannot be called after one.
  const task = taskFor(relativePath);
  const goBack = useGoBack(task?.backTo ?? '/');

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

  const setWorkspace = (next: Workspace) => {
    setWorkspaceState(next);
    try { localStorage.setItem(WORKSPACE_STORAGE_KEY, next); } catch { /* private mode */ }
    navigate(next === 'experience' ? '/x' : '/');
  };

  const page = headerContent ?? pageFor(relativePath);
  const status = statusMeta(provider.status);
  const showStatusBanner = provider.status !== 'active' && relativePath !== '/';

  return (
    <ProviderContextProvider provider={provider}>
    <WorkspaceContext.Provider value={{ workspace, setWorkspace }}>
      {/* Grey ground on a phone so the white sections read as cards; plain white on a desktop,
          where the console is a page rather than an app. */}
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-gray-50">
        {/* No app bar on a phone. A logo and a row of links at the top of a small screen cost a
            fifth of it to say what the person already knows; the sections are at the bottom and
            the page says its own name. */}
        <div className="hidden lg:block">
          <Header currentPath={relativePath} onNavigate={navigateTo} />
        </div>
        {/* A screen one level in gets a bar, because it is the way back. The ones whose bar is
            only back-and-a-name are drawn from the table above; a screen with something of its
            own in the corner is marked `bare` and draws its own. */}
        {task && !task.bare && (
          <SubPageHeader title={task.title} help={task.help} onBack={goBack} />
        )}
        {!task?.hideNav && <MobileNavBar currentPath={relativePath} onNavigate={navigateTo} />}
        {/* The bottom bar is fixed, so the scroll area has to end above it — otherwise the last
            row of every list sits underneath it. Task routes have no bar and need no gap. */}
        <main className={`relative min-h-0 flex-1 overflow-y-auto bg-gray-50 ${task?.hideNav ? '' : 'pb-16 lg:pb-0'}`}>
          <div className="mx-auto flex h-full w-full max-w-screen-xl flex-col">
            {showStatusBanner && (
              <div className="mx-3 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:mx-6 sm:mt-4">
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
    </WorkspaceContext.Provider>
    </ProviderContextProvider>
  );
}

export type ConsoleOutletContext = {
  navigateTo: (path: string) => void;
  setHeaderContent: (content: PageConfig | null) => void;
};
