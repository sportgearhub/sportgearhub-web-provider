import { useEffect, useRef, useState } from 'react';

/**
 * The formats either decoder can be asked for — a subset of what both accept, named as both name
 * them. A booking's pass is a QR code; what is printed on a box of gear is one of the 1-D ones.
 */
export type CodeFormat =
  | 'qr_code'
  | 'code_128'
  | 'code_39'
  | 'code_93'
  | 'ean_13'
  | 'ean_8'
  | 'itf'
  | 'upc_a'
  | 'upc_e';

export const QR_ONLY: CodeFormat[] = ['qr_code'];
/** What a label on a box of gear is printed in, plus QR, since many price tags carry one. */
export const PRODUCT_CODES: CodeFormat[] = ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'itf', 'upc_a', 'upc_e'];

/**
 * `BarcodeDetector` is a browser API rather than a library, and it is not in the DOM typings yet.
 * Chrome and Android ship it; Safari does not.
 */
type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => BarcodeDetectorLike;
  }
}

/**
 * The decoder, native where there is one.
 *
 * Writing a QR decoder is not the shortcut it looks like — finder patterns, perspective
 * correction, version and mask detection, then Reed-Solomon over a Galois field, every one of them
 * a place to be subtly wrong on a creased screen in bad light. `barcode-detector` is ZXing-C++
 * compiled to WebAssembly behind the exact API the browser exposes, so the code below does not
 * know which one it got.
 *
 * It is imported only when the native one is missing: a phone that has it never downloads the
 * WebAssembly. The binary is served from our own origin rather than the package's default CDN —
 * a counter on hotel wifi should not depend on jsDelivr being reachable, and Vite fingerprints and
 * caches it like any other asset.
 */
async function loadDetector(formats: CodeFormat[]): Promise<BarcodeDetectorLike> {
  if (window.BarcodeDetector) return new window.BarcodeDetector({ formats });

  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ]);
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
    },
  });
  return new BarcodeDetector({ formats });
}


/** What the camera is doing right now, as a screen needs to describe it. */
export type ScannerStatus = 'starting' | 'scanning' | 'paused' | 'denied';

/**
 * A camera pointed at a code, with its whole life in one effect.
 *
 * Everything it opens — the stream, the frame loop — is closed by the cleanup, which is what makes
 * it survive React's double mount in development, a tap on «Назад» mid-frame, and a code found
 * while a frame is still in flight. `onFound` is read through a ref: callers build it from props
 * that change on every render, and as a dependency it would tear the camera down and re-ask for
 * permission several times a second.
 *
 * It stops itself on a hit. A scanner that keeps reading while the thing it found is opening will
 * find it again, and again.
 */
export function useCodeScanner({
  active,
  formats = QR_ONLY,
  onFound,
}: {
  active: boolean;
  formats?: CodeFormat[];
  onFound: (value: string) => void;
}) {
  const [status, setStatus] = useState<ScannerStatus>('starting');
  const [attempt, setAttempt] = useState(0);
  const [paused, setPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const foundRef = useRef(onFound);
  foundRef.current = onFound;

  // A hit pauses the camera, which is right while the thing it found is opening — but a sheet
  // closed and opened again is a fresh ask, not a paused one, so putting it away clears the pause.
  useEffect(() => { if (!active) setPaused(false); }, [active]);

  useEffect(() => {
    if (!active || paused) {
      setStatus(paused ? 'paused' : 'starting');
      return;
    }
    let cancelled = false;
    let stream: MediaStream | null = null;
    let frame = 0;
    setStatus('starting');

    const run = async () => {
      try {
        // The back camera is the one pointed at the counter.
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const detector = await loadDetector(formats);
        if (cancelled) return;
        setStatus('scanning');

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const value = (await detector.detect(videoRef.current))[0]?.rawValue;
            if (value) {
              // Pausing tears this effect down, which stops the stream.
              setPaused(true);
              foundRef.current(value);
              return;
            }
          } catch {
            // A frame that cannot be read is not a failure; the next one usually can.
          }
          frame = requestAnimationFrame(() => void tick());
        };
        void tick();
      } catch {
        if (!cancelled) setStatus('denied');
      }
    };
    void run();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach(track => track.stop());
    };
    // `formats` is a literal at every call site; it is not re-created into a restart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, attempt, paused]);

  return {
    videoRef,
    status,
    scanning: status === 'scanning' && !paused,
    pause: () => setPaused(true),
    /** Ask again, after it was refused or switched off. */
    restart: () => { setPaused(false); setAttempt(count => count + 1); },
  };
}
