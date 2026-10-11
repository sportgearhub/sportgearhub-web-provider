import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Monitor, RefreshCw, Smartphone } from 'lucide-react';
import { Button } from '../../components/ui/Button';

/**
 * The seller's page on the customer app, inside the console.
 *
 * It is an iframe of the real page rather than a mock-up, because a mock-up of a storefront is a
 * drawing that goes out of date the week the storefront changes. What it cannot do is force the
 * app to be framed: that host answers `X-Frame-Options: SAMEORIGIN` for everything except its
 * `/preview/**` routes, so until `/providers/**` is added to the same allowlist this renders the
 * way out instead — the address, and a button that opens it.
 *
 * The block is detected by waiting: a frame that is refused never reports a load we can see from
 * here, and after a few seconds the fallback is the honest thing to show.
 */
export function StorefrontPreview({ url, device }: { url: string; device: 'phone' | 'desktop' }) {
  const [blocked, setBlocked] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const loaded = useRef(false);

  useEffect(() => {
    loaded.current = false;
    setBlocked(false);
    const timer = window.setTimeout(() => { if (!loaded.current) setBlocked(true); }, 3500);
    return () => window.clearTimeout(timer);
  }, [url, device, reloadKey]);

  const frame = (
    <iframe
      key={reloadKey}
      src={url}
      title="Витрина проката"
      onLoad={() => {
        // Cross-origin: we are told it loaded, never what. A refusal usually does not reach here
        // at all, which is what the timer above is for.
        loaded.current = true;
        setBlocked(false);
      }}
      className="h-full w-full border-0 bg-white"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
    />
  );

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setReloadKey(key => key + 1)}>
          <RefreshCw size={14} /> Обновить
        </Button>
        <Button variant="secondary" size="sm" asChild>
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> Открыть витрину
          </a>
        </Button>
      </div>

      {blocked ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-gray-400">
            {device === 'phone' ? <Smartphone size={20} /> : <Monitor size={20} />}
          </span>
          <p className="mt-3 text-sm font-medium text-gray-900">Витрина не показывается внутри кабинета</p>
          <p className="mt-1 max-w-sm text-xs leading-5 text-gray-500">
            Сайт запрещает встраивать свои страницы в другие сайты. Откройте витрину в новой
            вкладке — это та же страница, которую видит клиент.
          </p>
          <Button variant="primary" size="sm" className="mt-4" asChild>
            <a href={url} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> Открыть витрину
            </a>
          </Button>
          <p className="mt-3 break-all text-[11px] text-gray-400">{url}</p>
        </div>
      ) : device === 'phone' ? (
        /* A phone's width exactly, in a frame that looks like one: a storefront judged at desktop
           width is judged at a width most of its customers never see. */
        <div className="flex justify-center">
          <div className="h-[780px] w-[390px] overflow-hidden rounded-[2rem] border-8 border-gray-900 bg-white shadow-lg">
            {frame}
          </div>
        </div>
      ) : (
        /* A desktop storefront is wider than a phone: rather than squeeze it into one, the frame
           keeps a desktop's width and the page pans sideways to it. */
        <div className="overflow-x-auto">
          <div className="h-[780px] min-w-[1024px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            {frame}
          </div>
        </div>
      )}
    </div>
  );
}
