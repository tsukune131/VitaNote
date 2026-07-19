import { useEffect, useRef, useState } from 'react';
import { clearStepsParam, importSteps, readStepsParam } from '../lib/stepsImport';
import { formatDateShort } from '../lib/date';

/** URLの?steps=パラメータ(ショートカット連携)を取り込み、結果を一時表示する */
export function StepsImportBanner({ profileId }: { profileId: number }) {
  const [message, setMessage] = useState<string>();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const req = readStepsParam(window.location.search);
    if (!req) return;
    void importSteps(profileId, req).then(() => {
      clearStepsParam();
      setMessage(`ヘルスケアから ${formatDateShort(req.date)} の歩数 ${req.steps.toLocaleString()} 歩を取り込みました`);
      setTimeout(() => setMessage(undefined), 8000);
    });
  }, [profileId]);

  if (!message) return null;
  return <div className="import-banner">✓ {message}</div>;
}
