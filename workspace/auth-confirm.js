/* Supabase verifies the email before redirecting here. Require password sign in;
   do not import a URL session or replace an existing browser account. */
(() => {
  'use strict';
  const fragment = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  const failed = fragment.has('error') || fragment.has('error_code') || query.has('error') || query.has('error_code');
  // Remove callback credentials before loading any further page resources.
  history.replaceState(null, '', location.pathname);
  document.addEventListener('DOMContentLoaded', () => {
    if (!failed) return;
    document.getElementById('confirmation-title').textContent = 'Confirmation link unavailable';
    document.getElementById('confirmation-message').textContent =
      'This link may have expired or already been used. Try signing in. If your email is still unconfirmed, select Resend confirmation in Workspace.';
  });
})();
