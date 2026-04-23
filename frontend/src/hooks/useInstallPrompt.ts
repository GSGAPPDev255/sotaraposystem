/**
 * useInstallPrompt — captures the browser's beforeinstallprompt event
 * so we can show a custom "Add to Home Screen" banner.
 *
 * Returns:
 *  - isInstallable  : true when the app can be installed
 *  - isInstalled    : true when running in standalone (already installed)
 *  - promptInstall  : call this to trigger the native install dialog
 *  - dismiss        : hide the banner for this session
 */

import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const SESSION_KEY = 'sotara_install_dismissed';

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed,      setDismissed]      = useState(() => sessionStorage.getItem(SESSION_KEY) === '1');

  const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true);

  useEffect(() => {
    if (isInstalled) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isInstalled]);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setDismissed(true);
  }, []);

  return {
    isInstallable: !!deferredPrompt && !dismissed && !isInstalled,
    isInstalled,
    promptInstall,
    dismiss,
  };
}
