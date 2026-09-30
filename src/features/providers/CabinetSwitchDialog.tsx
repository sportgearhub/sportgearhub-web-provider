import { useNavigate } from 'react-router-dom';
import { Check, Plus } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../context/useAuth';
import { selectProvider } from '../../lib/active-provider';
import { kindLabel, roleLabel, statusMeta } from './providerStatus';

/**
 * Switching cabinet reloads every screen's data, so it asks in a dialog rather than happening on a
 * stray click in a menu. The list shows what distinguishes one cabinet from another — kind, role
 * and status — which a one-line menu row has no room for.
 */
export function CabinetSwitchDialog({
  open,
  currentProviderId,
  onClose,
}: {
  open: boolean;
  currentProviderId: string;
  onClose: () => void;
}) {
  const { providers } = useAuth();
  const navigate = useNavigate();

  const choose = (providerId: string) => {
    onClose();
    if (providerId === currentProviderId) return;
    selectProvider(providerId);
    navigate('/');
  };

  return (
    <Modal open={open} onClose={onClose} title="Выберите кабинет" size="sm">
      <div className="space-y-2">
        {providers.map(provider => {
          const meta = statusMeta(provider.status);
          const active = provider.providerId === currentProviderId;
          return (
            <button
              key={provider.providerId}
              type="button"
              onClick={() => choose(provider.providerId)}
              className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${
                active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-200'
              }`}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {active && <Check size={15} className="text-blue-700" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-gray-950">{provider.displayName}</span>
                <span className="block text-xs text-gray-500">
                  {kindLabel(provider.kind)} · {roleLabel(provider.role)}
                </span>
              </span>
              {provider.status !== 'active' && <Badge variant={meta.variant}>{meta.label}</Badge>}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex justify-between gap-3 border-t pt-4">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            onClose();
            navigate('/providers/new');
          }}
        >
          <Plus size={14} /> Добавить кабинет
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>Закрыть</Button>
      </div>
    </Modal>
  );
}
