import { useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Download, FileSpreadsheet, Minus, UploadCloud } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ApiError, stockBalanceApi } from '../../lib/api-client';
import type { Resource, StockBalanceApplyResult, StockBalancePreview, StockBalancePreviewRow } from '../../types';

interface StockBalancePageProps {
  resource: Resource;
  onBack: () => void;
}

type PageView = 'upload' | 'preview' | 'result';

export function StockBalancePage({ resource, onBack }: StockBalancePageProps) {
  const [view, setView] = useState<PageView>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState<StockBalancePreview | null>(null);
  const [result, setResult] = useState<StockBalanceApplyResult | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = async () => {
    setDownloading(true);
    setError('');
    try {
      const blob = await stockBalanceApi.downloadTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stock-balance-${resource.resourceId}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? `Не удалось скачать шаблон: ${err.message}` : 'Не удалось скачать шаблон.');
    } finally {
      setDownloading(false);
    }
  };

  const handleFile = (picked: File) => {
    setFile(picked);
    setPreview(null);
    setResult(null);
    setView('upload');
    setError('');
  };

  const runPreview = async () => {
    if (!file) return;
    setPreviewing(true);
    setError('');
    try {
      const data = await stockBalanceApi.preview(file);
      setPreview(data);
      setView('preview');
    } catch (err) {
      setError(err instanceof ApiError ? `Ошибка при проверке файла: ${err.message}` : 'Ошибка при проверке файла.');
    } finally {
      setPreviewing(false);
    }
  };

  const runApply = async () => {
    if (!file) return;
    setApplying(true);
    setError('');
    try {
      const data = await stockBalanceApi.apply(file);
      setResult(data);
      setView('result');
    } catch (err) {
      setError(err instanceof ApiError ? `Ошибка при применении изменений: ${err.message}` : 'Ошибка при применении изменений.');
    } finally {
      setApplying(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setView('upload');
    setError('');
  };

  const actionableRows = preview?.rows.filter(row => row.action !== 'none' && row.action !== 'error') ?? [];
  const errorRows = preview?.rows.filter(row => row.action === 'error') ?? [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Обновление остатков на складе</h3>
          <p className="mt-0.5 text-xs text-gray-500">{resource.title}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onBack}>
          Назад
        </Button>
      </div>

      <div className="px-6 py-6 max-w-2xl space-y-8">
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1 */}
        <div className="flex gap-4">
          <StepNumber n={1} done={false} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Скачайте и заполните шаблон</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              Файл содержит список активных вариантов с текущими остатками.
              Заполните столбец <strong className="text-gray-700">«Новый остаток»</strong> и сохраните файл.
              Строки с неизвестными артикулами будут пропущены.
            </p>
            <div className="mt-3">
              <Button variant="secondary" size="sm" onClick={() => void downloadTemplate()} loading={downloading}>
                <Download size={13} /> Скачать шаблон (.xlsx)
              </Button>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex gap-4">
          <StepNumber n={2} done={false} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Загрузите заполненный файл</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              Поддерживается только формат Excel (.xlsx). Читается лист <strong className="text-gray-700">«Остатки»</strong>.
              Строки, где новый остаток не является целым неотрицательным числом, пропускаются.
            </p>

            <div
              className={`mt-3 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition cursor-pointer
                ${dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
              `}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => {
                e.preventDefault();
                setDragging(false);
                const dropped = e.dataTransfer.files[0];
                if (dropped) handleFile(dropped);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              {file ? (
                <>
                  <FileSpreadsheet size={28} className="text-green-600" />
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} КБ · нажмите, чтобы заменить</p>
                </>
              ) : (
                <>
                  <UploadCloud size={28} className="text-gray-400" />
                  <p className="text-sm font-medium text-gray-700">Перетащите файл или нажмите для выбора</p>
                  <p className="text-xs text-gray-400">.xlsx, максимум 10 МБ</p>
                </>
              )}
            </div>

            {file && view !== 'result' && (
              <div className="mt-3">
                <Button variant="primary" size="sm" onClick={() => void runPreview()} loading={previewing} disabled={previewing}>
                  Проверить файл
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Step 3 — preview */}
        {view === 'preview' && preview && (
          <div className="flex gap-4">
            <StepNumber n={3} done={false} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">Просмотрите изменения и подтвердите</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                {actionableRows.length === 0 && errorRows.length === 0
                  ? 'Изменений нет — все остатки уже совпадают с файлом.'
                  : `${actionableRows.length} изменений${errorRows.length > 0 ? `, ${errorRows.length} ошибок (строки будут пропущены)` : ''}.`}
              </p>

              <PreviewTable rows={preview.rows} />

              {actionableRows.length > 0 && (
                <div className="mt-4 flex items-center gap-3">
                  <Button variant="primary" onClick={() => void runApply()} loading={applying} disabled={applying}>
                    Применить изменения
                  </Button>
                  <Button variant="secondary" onClick={reset} disabled={applying}>
                    Отмена
                  </Button>
                </div>
              )}
              {actionableRows.length === 0 && (
                <div className="mt-3">
                  <Button variant="secondary" size="sm" onClick={reset}>Загрузить другой файл</Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Result */}
        {view === 'result' && result && (
          <div className="flex gap-4">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center">
              <CheckCircle2 size={20} className="text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">Остатки обновлены</p>
              <p className="mt-1 text-xs text-gray-500">
                Изменения применены. {result.hasWarnings && 'Некоторые строки применены частично — см. предупреждения ниже.'}
              </p>
              <ResultTable rows={result.rows} />
              <div className="mt-4">
                <Button variant="secondary" size="sm" onClick={reset}>Обновить ещё раз</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepNumber({ n, done }: { n: number; done: boolean }) {
  return (
    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold
      ${done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
      {n}
    </div>
  );
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  none:          { label: 'Без изменений', color: 'text-gray-400' },
  create:        { label: 'Добавить',      color: 'text-green-700' },
  retire:        { label: 'Списать',       color: 'text-red-700' },
  partial_retire:{ label: 'Частично',      color: 'text-amber-700' },
  error:         { label: 'Ошибка',        color: 'text-red-600' },
};

function PreviewTable({ rows }: { rows: StockBalancePreviewRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-3 overflow-hidden rounded-md border border-gray-200">
      <table className="w-full table-fixed text-xs">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="w-[18%] px-3 py-2 text-left">Артикул</th>
            <th className="w-[24%] px-3 py-2 text-left">Вариант</th>
            <th className="w-[11%] px-3 py-2 text-right">Текущий</th>
            <th className="w-[11%] px-3 py-2 text-right">Новый</th>
            <th className="w-[10%] px-3 py-2 text-right">Δ</th>
            <th className="w-[14%] px-3 py-2 text-left">Действие</th>
            <th className="w-[12%] px-3 py-2 text-left"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const act = ACTION_LABELS[row.action] ?? ACTION_LABELS.none;
            return (
              <tr key={row.sku} className={`border-t border-gray-100 ${row.action === 'error' ? 'bg-red-50' : row.action === 'none' ? 'opacity-50' : ''}`}>
                <td className="px-3 py-2 font-mono font-medium text-gray-800">{row.sku}</td>
                <td className="px-3 py-2 text-gray-700 truncate">{row.label || '—'}</td>
                <td className="px-3 py-2 text-right text-gray-700">{row.action === 'error' ? '—' : row.currentBalance}</td>
                <td className="px-3 py-2 text-right text-gray-700">{row.action === 'error' ? '—' : row.targetBalance}</td>
                <td className="px-3 py-2 text-right">
                  {row.action === 'error' || row.delta === 0 ? (
                    <span className="text-gray-400"><Minus size={11} className="inline" /></span>
                  ) : row.delta > 0 ? (
                    <span className="text-green-700">+{row.delta} <ArrowUp size={11} className="inline" /></span>
                  ) : (
                    <span className="text-red-700">{row.delta} <ArrowDown size={11} className="inline" /></span>
                  )}
                </td>
                <td className={`px-3 py-2 font-medium ${act.color}`}>{act.label}</td>
                <td className="px-3 py-2 text-gray-500">
                  {row.error && <span className="text-red-600">{row.error}</span>}
                  {row.warning && !row.error && <span className="text-amber-600">{row.warning}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ResultTable({ rows }: { rows: StockBalanceApplyResult['rows'] }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-3 overflow-hidden rounded-md border border-gray-200">
      <table className="w-full table-fixed text-xs">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="w-[18%] px-3 py-2 text-left">Артикул</th>
            <th className="w-[26%] px-3 py-2 text-left">Вариант</th>
            <th className="w-[12%] px-3 py-2 text-right">Было</th>
            <th className="w-[12%] px-3 py-2 text-right">Стало</th>
            <th className="w-[14%] px-3 py-2 text-right">Создано</th>
            <th className="w-[14%] px-3 py-2 text-right">Списано</th>
            <th className="w-[4%] px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.sku} className="border-t border-gray-100">
              <td className="px-3 py-2 font-mono font-medium text-gray-800">{row.sku}</td>
              <td className="px-3 py-2 text-gray-700 truncate">{row.label}</td>
              <td className="px-3 py-2 text-right text-gray-500">{row.previousBalance}</td>
              <td className="px-3 py-2 text-right font-medium text-gray-900">{row.newBalance}</td>
              <td className="px-3 py-2 text-right text-green-700">{row.unitsCreated > 0 ? `+${row.unitsCreated}` : '—'}</td>
              <td className="px-3 py-2 text-right text-red-700">{row.unitsRetired > 0 ? `-${row.unitsRetired}` : '—'}</td>
              <td className="px-3 py-2">
                {row.warning && (
                  <span title={row.warning}>
                    <AlertTriangle size={13} className="text-amber-500" />
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
