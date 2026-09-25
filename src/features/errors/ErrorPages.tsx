import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom';
import { Compass, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FocusFrame } from '../../components/layout/FocusFrame';

/** An address that matches nothing. Inside the console, so the way out is one click of the nav. */
export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-md text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
          <Compass size={22} />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-gray-950">Страница не найдена</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          Такого раздела нет — возможно, ссылка устарела или в адресе опечатка.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="primary" onClick={() => navigate('/')}>На главную</Button>
          <Button variant="secondary" onClick={() => navigate(-1)}>Назад</Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The router's last resort. Without it a thrown error reaches the person as a stack trace on a
 * white page; this at least says what happened and offers the one thing that usually helps.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : null;
  const detail = isRouteErrorResponse(error)
    ? error.statusText || error.data
    : error instanceof Error
      ? error.message
      : null;

  return (
    <FocusFrame contentClassName="mx-auto w-full max-w-lg">
      <Card className="p-6 text-center">
        <h1 className="text-xl font-semibold text-gray-950">
          {status === 404 ? 'Страница не найдена' : 'Что-то пошло не так'}
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          {status === 404
            ? 'Такого раздела нет — возможно, ссылка устарела.'
            : 'Кабинет не смог отрисовать эту страницу. Попробуйте обновить — если повторится, напишите в поддержку.'}
        </p>
        {detail && (
          <p className="mt-3 break-words rounded-md bg-gray-50 px-3 py-2 text-left text-xs text-gray-600">{detail}</p>
        )}
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="primary" onClick={() => window.location.reload()}>
            <RefreshCw size={14} /> Обновить
          </Button>
          <Button variant="secondary" onClick={() => window.location.assign('/')}>На главную</Button>
        </div>
      </Card>
    </FocusFrame>
  );
}
