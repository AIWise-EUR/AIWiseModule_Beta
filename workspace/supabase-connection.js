/* Connection foundation. Existing local drafts are not uploaded or migrated. */
(() => {
  'use strict';
  const sdkUrl = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js';
  let clientPromise;

  function config() {
    const value = window.AIWiseSupabaseConfig;
    if (!value || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(value.url) ||
        !value.publishableKey?.startsWith('sb_publishable_')) {
      throw new Error('Supabase public connection settings are missing or invalid.');
    }
    return value;
  }

  function loadSdk() {
    if (window.supabase?.createClient) return Promise.resolve(window.supabase);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = sdkUrl;
      script.async = true;
      const timer = setTimeout(() => finish(new Error('Supabase client loading timed out.')), 15000);
      function finish(error) {
        clearTimeout(timer);
        script.onload = script.onerror = null;
        if (error) { script.remove(); reject(error); }
        else resolve(window.supabase);
      }
      script.onload = () => finish(window.supabase?.createClient ? null : new Error('Supabase client could not be initialized.'));
      script.onerror = () => finish(new Error('Supabase client could not be loaded. Check your connection and retry.'));
      document.head.appendChild(script);
    });
  }

  // Lazy: no SDK download or session work until an authenticated feature uses it.
  function getClient() {
    if (!clientPromise) {
      clientPromise = Promise.resolve().then(async () => {
        const settings = config();
        const sdk = await loadSdk();
        return sdk.createClient(settings.url, settings.publishableKey, {
          auth: {
            storageKey: 'aiwise_workspace_supabase_auth_v1',
            persistSession: true,
            autoRefreshToken: true,
            // Workspace routes use hashes. A future login screen must explicitly
            // handle its chosen callback flow rather than consuming route hashes.
            detectSessionInUrl: false
          }
        });
      }).catch(error => { clientPromise = undefined; throw error; });
    }
    return clientPromise;
  }

  // Read-only reachability/key check, not proof of login, RLS, or shared storage.
  async function checkConnection() {
    const settings = config();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(settings.url + '/auth/v1/settings', {
        headers: {apikey: settings.publishableKey},
        credentials: 'omit', cache: 'no-store', signal: controller.signal
      });
      if (!response.ok) throw new Error('Supabase connection check failed (HTTP ' + response.status + ').');
      const data = await response.json();
      if (!data.external || typeof data.external.email !== 'boolean') {
        throw new Error('Unexpected response from Supabase Auth.');
      }
      return {reachable: true, emailEnabled: data.external.email,
        signupEnabled: data.disable_signup === false, sharedStorageConnected: false};
    } finally { clearTimeout(timer); }
  }

  window.AIWiseBackend = Object.freeze({getClient, checkConnection});
})();
