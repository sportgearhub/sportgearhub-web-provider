import { useEffect, useState } from 'react';
import { authApi, type VerificationStage } from '../../lib/api-client';

/** Slow enough not to hammer the API, fast enough that an approved push feels instant. */
const POLL_INTERVAL_MS = 2000;

/**
 * Watches a verification that finishes somewhere else.
 *
 * With an MTS ID SIM push the user approves in the MTS app and the outcome reaches the API from
 * the provider — nothing about it is visible from the browser, so the only way to know is to ask.
 *
 * Polling stops as soon as the stage leaves `pending`, because every other stage is either
 * terminal or the client's cue to move on. A failed request is not one of those: a dropped
 * connection mid-wait should not end a sign-in that is very likely still succeeding, so it retries
 * on the same schedule.
 */
export function useVerificationStage(verificationId: string, initial: VerificationStage) {
  const [stage, setStage] = useState<VerificationStage>(initial);

  useEffect(() => {
    if (stage !== 'pending') return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const result = await authApi.verificationStage(verificationId);
        if (cancelled) return;

        setStage(result.stage);
        if (result.stage === 'pending') timer = setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        if (!cancelled) timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    // The response that started this already told us the stage, so the first ask belongs one
    // interval away rather than immediately.
    timer = setTimeout(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [verificationId, stage]);

  return stage;
}
