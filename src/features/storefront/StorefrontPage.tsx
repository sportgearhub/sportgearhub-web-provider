import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { CopyValue } from '../../components/ui/CopyValue';
import { QrCode, qrPngDataUrl, useQrMatrix } from '../../components/ui/QrCode';
import { SegmentedTabs } from '../../components/ui/SegmentedTabs';
import { SettingsCard } from '../../components/layout/SettingsCard';
import { Skeleton } from '../../components/ui/Skeleton';
import { profileApi } from '../../lib/api-client';
import { storefrontProviderUrl } from '../providers/providerStatus';
import { useProvider } from '../providers/ProviderContext';
import type { Provider } from '../../types';
import { StorefrontData, type LinkMode } from './StorefrontData';
import { StorefrontBlocks } from './StorefrontBlocks';
import { StorefrontPreview } from './StorefrontPreview';

const TABS = [
  { value: 'phone', label: 'Витрина для смартфона' },
  { value: 'desktop', label: 'Витрина для компьютера' },
  { value: 'data', label: 'Данные витрины' },
];

/**
 * Оформление магазина — what a customer sees of this prokat, and what can be changed about it.
 *
 * The two preview tabs frame the real page rather than drawing a picture of it, and the third is
 * the data behind it: the link, the name, the logo and the contacts. The address uses the slug
 * when there is one and the cabinet's id when there is not — the app's route takes either, so a
 * prokat always has a link to hand out, even before it has chosen a pretty one.
 */
export function StorefrontPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const provider = useProvider();
  const [tab, setTab] = useState('data');
  const [profile, setProfile] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  // Which form of the address is on screen — and in the QR code beside it, since a code of a link
  // the seller is not looking at is a code nobody asked for.
  const [linkMode, setLinkMode] = useState<LinkMode>('slug');

  useEffect(() => {
    let cancelled = false;
    profileApi.get()
      .then(next => {
        if (cancelled) return;
        setProfile(next);
        if (!next.slug) setLinkMode('id');
      })
      .catch(() => { /* the link falls back to the cabinet's id, which always works */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const url = storefrontProviderUrl(
    linkMode === 'slug' && profile?.slug ? profile.slug : provider.providerId
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="px-4 pt-4 sm:px-6 sm:pt-6">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Магазин</p>
        <h1 className="mt-0.5 text-xl font-semibold text-gray-950">Оформление магазина</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Как прокат выглядит для клиента — на телефоне и на компьютере.
        </p>

        <div className="mt-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <SegmentedTabs items={TABS} value={tab} onChange={setTab} className="inline-flex" />
        </div>
      </div>

      {tab === 'data' ? (
        <div className="min-h-0 flex-1 space-y-4 px-4 py-4 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-4 lg:space-y-0">
          <StorefrontData
            profile={profile}
            providerId={provider.providerId}
            loading={loading}
            linkMode={linkMode}
            onLinkMode={setLinkMode}
            onProfile={patch => setProfile(current => (current ? { ...current, ...patch } : current))}
            onNavigate={onNavigate}
          />
          <ShopQrCard url={url} />
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-start">
          <StorefrontBlocks />
          <StorefrontPreview url={url} device={tab === 'phone' ? 'phone' : 'desktop'} />
        </div>
      )}
    </div>
  );
}

/**
 * The storefront's QR code, for a counter, a card or a leaflet.
 *
 * Drawn here rather than fetched: the address is known, and a code generated on the page is one
 * fewer thing to go stale when the slug changes. Downloaded as a PNG big enough to print.
 */
function ShopQrCard({ url }: { url: string }) {
  const matrix = useQrMatrix(url);

  const download = useMemo(() => () => {
    if (!matrix) return;
    const href = qrPngDataUrl(matrix);
    if (!href) return;
    const link = document.createElement('a');
    link.href = href;
    link.download = 'sportgearhub-qr.png';
    link.click();
  }, [matrix]);

  return (
    <SettingsCard title="QR-код магазина" description="Ведёт на страницу проката в приложении.">
      <div className="rounded-2xl bg-gray-50 p-4">
        {matrix ? (
          <QrCode value={url} label="QR-код витрины проката" className="mx-auto h-48 w-48" />
        ) : (
          <Skeleton className="mx-auto h-48 w-48" />
        )}
      </div>

      <p className="mt-3 text-xs leading-5 text-gray-600">
        Разместите его на стойке, визитке или листовке — клиент наведёт камеру и попадёт на вашу
        витрину, где видно всё снаряжение и свободные даты.
      </p>

      <CopyValue value={url} label="ссылка на витрину" className="mt-2 text-xs" />

      <Button variant="primary" className="mt-3 w-full justify-center" onClick={download} disabled={!matrix}>
        <Download size={15} /> Скачать PNG
      </Button>
    </SettingsCard>
  );
}
