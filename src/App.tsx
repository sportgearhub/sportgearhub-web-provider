import { Navigate, Outlet, RouterProvider, createBrowserRouter, useLocation, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { selectProvider } from './lib/active-provider';
import { CompleteRegistrationPage, PasscodeSetupPage, PasscodeSignInPage, SignInPage } from './features/auth/AuthPages';
import { ProviderPickerPage } from './features/providers/ProviderPickerPage';
import { CreateProviderPage } from './features/providers/CreateProviderPage';
import { ConsoleLayout, type ConsoleOutletContext } from './components/layout/ConsoleLayout';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { BookingsPage } from './features/bookings/BookingsPage';
import { BookingDetailPage } from './features/bookings/BookingDetailPage';
import { BookingFiltersPage } from './features/bookings/BookingFiltersPage';
import { BookingsCalendarPage } from './features/bookings/BookingsCalendarPage';
import { ScanPage } from './features/scan/ScanPage';
import { MenuPage } from './features/menu/MenuPage';
import { SettingsListPage } from './features/menu/SettingsListPage';
import { FinancesPage } from './features/finances/FinancesPage';
import { StatementPage } from './features/finances/StatementPage';
import { AccrualsPage } from './features/finances/AccrualsPage';
import { RatingsPage } from './features/ratings/Ratings';
import {
  ExperienceBookingsPage,
  ExperienceDashboardPage,
  ExperienceFinancesPage,
  ExperienceSchedulePage,
  ExperiencesPage,
} from './features/experiences/ExperiencePages';
import { ProductsPage } from './features/products/ProductsPage';
import { ProductDetailPage } from './features/products/ProductDetailPage';
import { ProductGroupPage, ProductGroupsPage } from './features/products/ProductGroupsPage';
import { ProductFiltersPage } from './features/products/ProductFiltersPage';
import { ProductSelectPage } from './features/products/ProductSelectPage';
import { ProductForm } from './features/products/ProductForm';
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

function BookingsRoute() {
  const { navigateTo } = useConsole();
  return <BookingsPage onNavigate={navigateTo} />;
}

function ExperienceRoute({ page }: { page: 'home' | 'list' | 'schedule' | 'bookings' | 'finances' }) {
  const { navigateTo } = useConsole();
  if (page === 'list') return <ExperiencesPage onNavigate={navigateTo} />;
  if (page === 'schedule') return <ExperienceSchedulePage />;
  if (page === 'bookings') return <ExperienceBookingsPage />;
  if (page === 'finances') return <ExperienceFinancesPage />;
  return <ExperienceDashboardPage onNavigate={navigateTo} />;
}

function MenuRoute() {
  const { navigateTo } = useConsole();
  return <MenuPage onNavigate={navigateTo} />;
}

function FinancesRoute() {
  const { navigateTo } = useConsole();
  return <FinancesPage onNavigate={navigateTo} />;
}

function SettingsListRoute() {
  const { navigateTo } = useConsole();
  return <SettingsListPage onNavigate={navigateTo} />;
}

function StatementRoute() {
  const { navigateTo } = useConsole();
  const { periodEnd = '' } = useParams();
  return <StatementPage periodEnd={periodEnd} onNavigate={navigateTo} />;
}

function ScanRoute() {
  const { navigateTo } = useConsole();
  return <ScanPage onNavigate={navigateTo} />;
}

function BookingFiltersRoute() {
  const { navigateTo } = useConsole();
  return <BookingFiltersPage onNavigate={navigateTo} />;
}

function BookingsCalendarRoute() {
  const { navigateTo } = useConsole();
  return <BookingsCalendarPage onNavigate={navigateTo} />;
}

function BookingDetailRoute() {
  const { navigateTo } = useConsole();
  const { bookingId = '' } = useParams();
  return <BookingDetailPage bookingId={bookingId} onNavigate={navigateTo} />;
}

function ProductsRoute() {
  const { navigateTo } = useConsole();
  return <ProductsPage onNavigate={navigateTo} />;
}

function ProductGroupsRoute() {
  const { navigateTo } = useConsole();
  return <ProductGroupsPage onNavigate={navigateTo} />;
}

function ProductGroupRoute() {
  const { navigateTo } = useConsole();
  const { groupName = '' } = useParams();
  return <ProductGroupPage groupName={decodeURIComponent(groupName)} onNavigate={navigateTo} />;
}

function ProductFiltersRoute() {
  const { navigateTo } = useConsole();
  return <ProductFiltersPage onNavigate={navigateTo} />;
}

function ProductSelectRoute() {
  const { navigateTo } = useConsole();
  const [params] = useSearchParams();
  return <ProductSelectPage onNavigate={navigateTo} pick={params.get('pick') ?? undefined} />;
}

function ProductDetailRoute() {
  const { navigateTo } = useConsole();
  const { productId = '' } = useParams();
  return <ProductDetailPage productId={productId} onNavigate={navigateTo} />;
}

function ProductFormRoute({ mode }: { mode: 'create' | 'edit' }) {
  const { navigateTo } = useConsole();
  const { productId } = useParams();
  return <ProductForm productId={mode === 'edit' ? productId : undefined} onNavigate={navigateTo} />;
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
          { path: 'bookings', element: <BookingsRoute /> },
          { path: 'bookings/filters', element: <BookingFiltersRoute /> },
          { path: 'bookings/calendar', element: <BookingsCalendarRoute /> },
          { path: 'bookings/:bookingId', element: <BookingDetailRoute /> },
          { path: 'scan', element: <ScanRoute /> },
          { path: 'finances', element: <FinancesRoute /> },
          { path: 'finances/accruals', element: <AccrualsPage /> },
          { path: 'finances/statements/:periodEnd', element: <StatementRoute /> },
          { path: 'menu', element: <MenuRoute /> },
          { path: 'ratings', element: <RatingsPage /> },

          // Впечатления — a prototype workspace with no API behind it yet.
          { path: 'x', element: <ExperienceRoute page="home" /> },
          { path: 'x/experiences', element: <ExperienceRoute page="list" /> },
          { path: 'x/schedule', element: <ExperienceRoute page="schedule" /> },
          { path: 'x/bookings', element: <ExperienceRoute page="bookings" /> },
          { path: 'x/finances', element: <ExperienceRoute page="finances" /> },
          { path: 'products', element: <ProductsRoute /> },
          { path: 'products/new', element: <ProductFormRoute mode="create" /> },
          { path: 'products/groups', element: <ProductGroupsRoute /> },
          { path: 'products/groups/:groupName', element: <ProductGroupRoute /> },
          { path: 'products/filters', element: <ProductFiltersRoute /> },
          { path: 'products/select', element: <ProductSelectRoute /> },
          { path: 'products/:productId', element: <ProductDetailRoute /> },
          { path: 'products/:productId/edit', element: <ProductFormRoute mode="edit" /> },
          // The catalogue was two sections until the API collapsed them into one product.
          { path: 'resources/*', element: <Navigate to="/products" replace /> },
          { path: 'offers/*', element: <Navigate to="/products" replace /> },
          { path: 'settings', element: <Navigate to="shop" replace /> },
          { path: 'settings', element: <SettingsListRoute /> },
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
