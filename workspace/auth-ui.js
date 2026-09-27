/* Shared account dialog; no navigation away from unsaved editor work. */
(() => {
  'use strict';
  const trigger = document.createElement('button');
  trigger.type = 'button'; trigger.className = 'aw-account-trigger';
  trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-controls', 'aw-account-dialog');
  trigger.innerHTML = '<span class="aw-account-dot" aria-hidden="true"></span><span id="aw-account-label">Sign in</span>';
  const bottom = document.querySelector('.sidebar-bottom');
  if (!bottom) return;
  bottom.prepend(trigger);
  const dialog = document.createElement('dialog');
  dialog.id = 'aw-account-dialog'; dialog.className = 'aw-account-dialog';
  dialog.setAttribute('aria-labelledby', 'aw-account-title');
  dialog.innerHTML = `<div class="aw-account-header"><div><p class="aw-account-eyebrow">AI-Wise Workspace</p><h2 id="aw-account-title">Team sign in</h2></div><button type="button" class="aw-account-close" aria-label="Close account window">×</button></div>
    <div class="aw-account-body">
      <p id="aw-account-status" role="status" aria-live="polite"></p>
      <p id="aw-account-email" hidden></p>
      <form id="aw-signin-form">
        <label for="aw-auth-email">Email</label><input id="aw-auth-email" type="email" autocomplete="username" required maxlength="254">
        <label for="aw-auth-password">Password</label><input id="aw-auth-password" type="password" autocomplete="current-password" required>
        <button class="aw-account-button primary" type="submit" id="aw-signin">Sign in</button>
        <p class="aw-account-help">Use the workspace account created by your project administrator. Your Supabase dashboard account is separate.</p>
      </form>
      <div class="aw-account-actions"><button class="aw-account-button" type="button" id="aw-auth-refresh">Check again</button><button class="aw-account-button" type="button" id="aw-signout" hidden>Sign out</button></div>
      <p id="aw-account-error" class="aw-account-error" role="alert"></p>
      <p class="aw-account-local-note">Drafts and requests are still saved in this browser. Signing in does not upload them; signing out does not delete them.</p>
    </div>`;
  document.body.appendChild(dialog);
  const form = dialog.querySelector('form'), email = dialog.querySelector('#aw-auth-email');
  const password = dialog.querySelector('#aw-auth-password'), error = dialog.querySelector('#aw-account-error');
  const refreshButton = dialog.querySelector('#aw-auth-refresh'), signOutButton = dialog.querySelector('#aw-signout');
  let busy = false, state, cancelClose;
  function paint(value) {
    state = value;
    trigger.querySelector('#aw-account-label').textContent = value.user ? 'Account' : 'Sign in';
    trigger.dataset.member = String(value.status === 'member');
    dialog.dataset.status = value.status;
    dialog.querySelector('#aw-account-title').textContent = value.user ? 'Your account' : 'Team sign in';
    dialog.querySelector('#aw-account-status').textContent = value.message;
    const accountEmail = dialog.querySelector('#aw-account-email');
    accountEmail.textContent = value.user?.email || ''; accountEmail.hidden = !value.user;
    form.hidden = !!value.user;
    signOutButton.hidden = !value.user;
    for (const control of [...form.elements, refreshButton, signOutButton]) {
      control.disabled = busy || value.status === 'checking';
    }
  }
  function closeNow() {
    cancelClose?.(); cancelClose = null; window.AIWiseMotion.cancel(dialog);
    dialog.close(); password.value = ''; error.textContent = '';
    document.querySelector('.sidebar-rail button')?.focus({preventScroll: true});
  }
  function close() {
    if (!dialog.open || cancelClose) return;
    if (window.AIWiseMotion.reduced()) { closeNow(); return; }
    dialog.style.setProperty('--aw-enter-duration', 'var(--aw-motion-page)');
    dialog.classList.add('aw-leaving');
    cancelClose = window.AIWiseMotion.after(dialog, closeNow);
  }
  trigger.addEventListener('click', () => {
    window.AIWiseSidebar.close(false);
    cancelClose?.(); cancelClose = null; window.AIWiseMotion.cancel(dialog);
    error.textContent = ''; dialog.showModal(); window.AIWiseMotion.enter(dialog);
    if (!state.user && !email.disabled) email.focus({preventScroll: true});
    else dialog.querySelector('.aw-account-close').focus({preventScroll: true});
  });
  dialog.querySelector('.aw-account-close').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  const outside = event => { const r = dialog.getBoundingClientRect(); return event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom; };
  let backdropDown = false;
  dialog.addEventListener('pointerdown', event => { backdropDown = event.target === dialog && outside(event); });
  dialog.addEventListener('click', event => { if (backdropDown && event.target === dialog && outside(event)) close(); backdropDown = false; });
  async function action(fn) {
    if (busy) return;
    busy = true; error.textContent = ''; paint(state);
    try { await fn(); }
    catch (failure) { error.textContent = failure.message || 'Account action failed. Please try again.'; }
    finally { busy = false; password.value = ''; paint(window.AIWiseAuth.snapshot()); }
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const loginEmail = email.value, loginPassword = password.value;
    action(() => window.AIWiseAuth.signIn(loginEmail, loginPassword));
  });
  signOutButton.addEventListener('click', () => action(() => window.AIWiseAuth.signOut()));
  refreshButton.addEventListener('click', () => action(() => window.AIWiseAuth.refresh()));
  window.AIWiseAuth.subscribe(paint);
})();
