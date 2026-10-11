import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';

/**
 * A QR code of `value`, drawn as SVG rectangles rather than injected markup.
 *
 * The encoder (`qrcode-generator`, no dependencies of its own) is imported on first use, so a
 * screen without a code never downloads it. Error correction M and a four-module quiet zone —
 * the same component the customer app draws booking passes with, so the two agree about what a
 * scannable code looks like.
 */
export function QrCode({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const matrix = useQrMatrix(value);

  if (!matrix) return <div className={cn('animate-pulse rounded-xl bg-gray-100', className)} aria-hidden="true" />;

  const quiet = 4;
  const size = matrix.length + quiet * 2;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={cn('bg-white', className)}
    >
      <path
        fill="#000"
        d={matrix
          .flatMap((row, r) => row.map((dark, c) => (dark ? `M${c + quiet} ${r + quiet}h1v1h-1z` : '')))
          .join('')}
      />
    </svg>
  );
}

/** The modules themselves, for a caller that wants to draw them somewhere else — a PNG, say. */
export function useQrMatrix(value: string) {
  const [matrix, setMatrix] = useState<boolean[][] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMatrix(null);
    void import('qrcode-generator').then(({ default: qrcode }) => {
      const qr = qrcode(0, 'M');
      qr.addData(value);
      qr.make();
      const count = qr.getModuleCount();
      const rows = Array.from({ length: count }, (_, row) =>
        Array.from({ length: count }, (_, column) => qr.isDark(row, column)));
      if (!cancelled) setMatrix(rows);
    });
    return () => { cancelled = true; };
  }, [value]);

  return matrix;
}

/**
 * The same code as a PNG, at a size worth printing.
 *
 * Drawn straight from the modules rather than rasterised from the SVG: a canvas filled square by
 * square has no blurred edges, and a blurred QR code is a QR code a till cannot read.
 */
export function qrPngDataUrl(matrix: boolean[][], pixelsPerModule = 12): string | null {
  const quiet = 4;
  const size = (matrix.length + quiet * 2) * pixelsPerModule;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);
  context.fillStyle = '#000000';
  matrix.forEach((row, r) => row.forEach((dark, c) => {
    if (dark) {
      context.fillRect((c + quiet) * pixelsPerModule, (r + quiet) * pixelsPerModule, pixelsPerModule, pixelsPerModule);
    }
  }));
  return canvas.toDataURL('image/png');
}
