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
  const [slow, setSlow] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const loaded = useRef(false);

  useEffect(() => {
    loaded.current = false;
    setSlow(false);
    const timer = window.setTimeout(() => { if (!loaded.current) setSlow(true); }, 4000);
    return () => window.clearTimeout(timer);
  }, [url, device, reloadKey]);

  const frame = (
    <iframe
      key={reloadKey}
      src={url}
      title="Витрина проката"
      onLoad={() => {
        // Cross-origin: we are told it loaded, never what is in it.
        loaded.current = true;
        setSlow(false);
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

      {/* A note beside the frame, never instead of it. Whether a cross-origin page rendered is
          not a question this side can answer — the first version replaced the preview on a timer
          and tore down a storefront that was loading perfectly well, mid-scroll. */}
      {slow && (
        <p className="mb-2 flex flex-wrap items-center gap-x-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          <span className="flex items-center gap-1.5">
            {device === 'phone' ? <Smartphone size={13} /> : <Monitor size={13} />}
            Если витрина не появилась — сайт запрещает встраивать свои страницы.
          </span>
          <a href={url} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">
            Открыть в новой вкладке
          </a>
        </p>
      )}

      {device === 'phone' ? (
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
