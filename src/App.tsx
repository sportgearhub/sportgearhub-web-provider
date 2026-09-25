import { Navigate, Outlet, RouterProvider, createBrowserRouter, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { selectProvider } from './lib/active-provider';
import { CompleteRegistrationPage, PasscodeSetupPage, PasscodeSignInPage, SignInPage } from './features/auth/AuthPages';
import { ProviderPickerPage } from './features/providers/ProviderPickerPage';
import { CreateProviderPage } from './features/providers/CreateProviderPage';
import { ConsoleLayout, type ConsoleOutletContext } from './components/layout/ConsoleLayout';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { FulfillmentPage } from './features/fulfillment/FulfillmentPage';
import { ResourcesPage } from './features/resources/ResourcePage';
import { ResourceCreatePage } from './features/resources/ResourceCreatePage';
import { ResourceDetailPage } from './features/resources/ResourceDetailPage';
import { ResourceEditPage } from './features/resources/ResourceEditPage';
import { OffersPage } from './features/offers/OffersPage';
import { OfferCreatePage } from './features/offers/OfferCreatePage';
import {
  OfferAvailabilityEditRoute,
  OfferAvailabilityRoute,
  OfferCreateRoute as OfferCreateStandaloneRoute,
  OfferDetailRoute,
  OfferEditRoute,
  OfferPolicyRoute,
} from './features/offers/OfferRoutes';
import { SettingsPage, type SettingsTab } from './features/settings/SettingsPage';
import { NotFoundPage, RouteErrorPage } from './features/errors/ErrorPages';

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <p className="text-xs text-gray-500">Загрузка...</p>
      </div>
    </div>
  );
}

// The auth pages predate the router and navigate through a callback; this is the one adapter.
function useLegacyNavigate() {
  const navigate = useNavigate();
  return (path: string, replace?: boolean) => navigate(path, { replace });
}

function AuthRoute({ page }: { page: 'sign-in' | 'passcode' | 'passcode-setup' | 'complete-registration' }) {
  const onNavigate = useLegacyNavigate();
  const params = new URLSearchParams(useLocation().search);
  switch (page) {
    case 'passcode':
      return <PasscodeSignInPage onNavigate={onNavigate} />;
    case 'passcode-setup':
      return <PasscodeSetupPage onNavigate={onNavigate} />;
    case 'complete-registration':
      return <CompleteRegistrationPage token={params.get('token')} onNavigate={onNavigate} />;
    default:
      return <SignInPage onNavigate={onNavigate} />;
  }
}

/** Everything outside /auth needs a session; without one, the sign-in page. */
function RequireSession() {
  const { user, loading } = useAuth();
  const onNavigate = useLegacyNavigate();
  if (loading) return <Loading />;
  if (!user) return <SignInPage onNavigate={onNavigate} />;
  return <Outlet />;
}

/** Links from when the cabinet lived in the URL: select that cabinet, then open the same page. */
function ScopedLinkRedirect() {
  const { providerId = '' } = useParams();
  const { providers } = useAuth();
  const location = useLocation();
  const rest = location.pathname.replace(/^\/providers\/[^/]+/, '') || '/';
  if (!providers.some(item => item.providerId === providerId)) {
    return <Navigate to="/providers" replace state={{ deniedProviderId: providerId }} />;
  }
  selectProvider(providerId);
  return <Navigate to={`${rest}${location.search}`} replace />;
}

// Console pages still take their navigation and header hooks as props.
function useConsole() {
  return useOutletContext<ConsoleOutletContext>();
}

function DashboardRoute() {
  const { navigateTo } = useConsole();
  return <DashboardPage onNavigate={navigateTo} />;
}

function ResourcesRoute() {
  const { navigateTo, setHeaderContent } = useConsole();
  return <ResourcesPage onHeaderContentChange={setHeaderContent} onNavigate={navigateTo} />;
}

function ResourceCreateRoute() {
  const { navigateTo, setHeaderContent } = useConsole();
  return <ResourceCreatePage onNavigate={navigateTo} onHeaderContentChange={setHeaderContent} />;
}

function ResourceDetailRoute() {
  const { navigateTo, setHeaderContent } = useConsole();
  const { resourceId = '' } = useParams();
  return <ResourceDetailPage resourceId={resourceId} onNavigate={navigateTo} onHeaderContentChange={setHeaderContent} />;
}

function ResourceEditRoute() {
  const { navigateTo, setHeaderContent } = useConsole();
  const { resourceId = '' } = useParams();
  return <ResourceEditPage resourceId={resourceId} onNavigate={navigateTo} onHeaderContentChange={setHeaderContent} />;
}

function OfferCreateRoute() {
  const { navigateTo, setHeaderContent } = useConsole();
  const { resourceId = '' } = useParams();
  return <OfferCreatePage resourceId={resourceId} onNavigate={navigateTo} onHeaderContentChange={setHeaderContent} />;
}

function OffersListRoute() {
  const { navigateTo } = useConsole();
  return <OffersPage onNavigate={navigateTo} />;
}

/** One component per offer page, each reading the id from the URL. */
function OfferCreateStandalone() {
  const { navigateTo } = useConsole();
  return <OfferCreateStandaloneRoute onNavigate={navigateTo} />;
}

function OfferRoute({ page }: { page: 'detail' | 'edit' | 'availability' | 'availability-edit' | 'policy' }) {
  const { navigateTo } = useConsole();
  const { offerId = '' } = useParams();
  switch (page) {
    case 'edit':
      return <OfferEditRoute offerId={offerId} onNavigate={navigateTo} />;
    case 'availability':
      return <OfferAvailabilityRoute offerId={offerId} onNavigate={navigateTo} />;
    case 'availability-edit':
      return <OfferAvailabilityEditRoute offerId={offerId} onNavigate={navigateTo} />;
    case 'policy':
      return <OfferPolicyRoute offerId={offerId} onNavigate={navigateTo} />;
    default:
      return <OfferDetailRoute offerId={offerId} onNavigate={navigateTo} />;
  }
}

function SettingsRoute({ tab }: { tab: SettingsTab }) {
  const { navigateTo } = useConsole();
  return <SettingsPage tab={tab} onNavigate={navigateTo} />;
}

const router = createBrowserRouter([
  { path: '/auth/passcode', element: <AuthRoute page="passcode" /> },
  { path: '/auth/passcode-setup', element: <AuthRoute page="passcode-setup" /> },
  { path: '/auth/complete-registration', element: <AuthRoute page="complete-registration" /> },
  { path: '/auth/*', element: <AuthRoute page="sign-in" /> },
  {
    element: <RequireSession />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/providers', element: <ProviderPickerPage /> },
      { path: '/providers/new', element: <CreateProviderPage /> },
      { path: '/providers/:providerId/*', element: <ScopedLinkRedirect /> },
      {
        path: '/',
        element: <ConsoleLayout />,
        children: [
          { index: true, element: <DashboardRoute /> },
          { path: 'fulfillment', element: <FulfillmentPage /> },
          { path: 'resources', element: <ResourcesRoute /> },
          { path: 'resources/create', element: <ResourceCreateRoute /> },
          { path: 'resources/:resourceId', element: <ResourceDetailRoute /> },
          { path: 'resources/:resourceId/edit', element: <ResourceEditRoute /> },
          { path: 'resources/:resourceId/offers/new', element: <OfferCreateRoute /> },
          { path: 'offers', element: <OffersListRoute /> },
          { path: 'offers/new', element: <OfferCreateStandalone /> },
          { path: 'offers/:offerId', element: <OfferRoute page="detail" /> },
          { path: 'offers/:offerId/edit', element: <OfferRoute page="edit" /> },
          { path: 'offers/:offerId/availability', element: <OfferRoute page="availability" /> },
          { path: 'offers/:offerId/availability/edit', element: <OfferRoute page="availability-edit" /> },
          { path: 'offers/:offerId/policy', element: <OfferRoute page="policy" /> },
          { path: 'settings', element: <Navigate to="shop" replace /> },
          { path: 'settings/shop', element: <SettingsRoute tab="shop" /> },
          { path: 'settings/shop/edit', element: <SettingsRoute tab="shop-edit" /> },
          { path: 'settings/seller', element: <SettingsRoute tab="seller" /> },
          { path: 'settings/seller/edit', element: <SettingsRoute tab="seller-edit" /> },
          { path: 'settings/locations', element: <SettingsRoute tab="locations" /> },
          { path: 'settings/employees', element: <SettingsRoute tab="employees" /> },
          { path: 'settings/payouts', element: <SettingsRoute tab="payouts" /> },
          { path: 'settings/contracts', element: <SettingsRoute tab="contracts" /> },
          { path: 'settings/account', element: <SettingsRoute tab="account" /> },
          { path: 'onboarding', element: <Navigate to="/" replace /> },
          { path: 'new', element: <Navigate to="/providers/new" replace /> },
          { path: 'payouts', element: <Navigate to="/settings/payouts" replace /> },
          { path: 'locations', element: <Navigate to="/settings/locations" replace /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
