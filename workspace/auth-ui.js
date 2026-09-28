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
      <p id="aw-account-notice" class="aw-account-notice" role="status" hidden></p>
      <p id="aw-account-error" class="aw-account-error" role="alert"></p>
      <form id="aw-signin-form">
        <label for="aw-auth-email">Email</label><input id="aw-auth-email" type="email" autocomplete="username" required maxlength="254">
        <label for="aw-auth-password">Password</label><input id="aw-auth-password" type="password" autocomplete="current-password" required>
        <div id="aw-confirm-field" hidden><label for="aw-auth-confirm">Confirm password</label><input id="aw-auth-confirm" type="password" autocomplete="new-password"></div>
        <button class="aw-account-button primary" type="submit" id="aw-signin">Sign in</button>
        <p class="aw-account-help" id="aw-account-help">Use your AI-Wise account. Your Supabase dashboard account is separate.</p>
        <button class="aw-account-button" type="button" id="aw-resend-confirmation">Resend confirmation</button>
      </form>
      <div class="aw-account-actions"><button class="aw-account-button" type="button" id="aw-auth-refresh" hidden>Retry</button><button class="aw-account-button" type="button" id="aw-signout" hidden>Sign out</button></div>
      <div id="aw-account-modes" class="aw-account-switch">
        <p id="aw-account-switch-hint">Don’t have an account yet?</p>
        <button type="button" class="aw-account-button" id="aw-mode-signup">Create account</button>
        <button type="button" class="aw-account-button" id="aw-mode-signin" hidden>Sign in</button>
      </div>
      <p class="aw-account-local-note">Drafts and requests are still saved in this browser. Signing in does not upload them; signing out does not delete them.</p>
    </div>`;
  document.body.appendChild(dialog);
  const form = dialog.querySelector('form'), email = dialog.querySelector('#aw-auth-email');
  const password = dialog.querySelector('#aw-auth-password'), error = dialog.querySelector('#aw-account-error');
  const refreshButton = dialog.querySelector('#aw-auth-refresh'), signOutButton = dialog.querySelector('#aw-signout');
  const confirmPassword = dialog.querySelector('#aw-auth-confirm');
  const modeButtons = [dialog.querySelector('#aw-mode-signin'), dialog.querySelector('#aw-mode-signup')];
  const notice = dialog.querySelector('#aw-account-notice'), resend = dialog.querySelector('#aw-resend-confirmation');
  let busy = false, state, cancelClose, mode = 'signin', resendAfter = 0, resendTimer, retrySignIn = false;
  function showNotice(message) { notice.textContent = message; notice.hidden = !message; }
  function cooldown() {
    resendAfter = Date.now() + 60000;
    clearTimeout(resendTimer);
    resendTimer = setTimeout(() => paint(state), 60000);
  }
  function setMode(next) {
    mode = next; retrySignIn = false; password.value = ''; confirmPassword.value = '';
    confirmPassword.setCustomValidity(''); error.textContent = ''; showNotice(''); paint(state);
    email.focus({preventScroll: true});
  }
  function paint(value) {
    state = value;
    const signup = mode === 'signup';
    trigger.querySelector('#aw-account-label').textContent = value.user ? 'Account' : 'Sign in';
    trigger.dataset.member = String(value.status === 'member');
    dialog.dataset.status = value.status;
    dialog.querySelector('#aw-account-title').textContent = value.user ? 'Your account' : signup ? 'Create your account' : retrySignIn ? 'Sign-in failed' : 'Team sign in';
    dialog.querySelector('#aw-account-status').textContent = !value.user && signup && value.status !== 'checking' ?
      'Create an account, confirm your email, then ask an administrator to approve team access.' : value.message;
    const accountEmail = dialog.querySelector('#aw-account-email');
    accountEmail.textContent = value.user?.email || ''; accountEmail.hidden = !value.user;
    form.hidden = !!value.user;
    dialog.querySelector('#aw-account-modes').hidden = !!value.user;
    if (value.user) showNotice('');
    modeButtons[0].hidden = !signup;
    modeButtons[1].hidden = signup;
    dialog.querySelector('#aw-account-switch-hint').textContent = signup ? 'Already have an account?' : 'Don’t have an account yet?';
    dialog.querySelector('#aw-confirm-field').hidden = !signup;
    confirmPassword.required = signup;
    password.autocomplete = signup ? 'new-password' : 'current-password';
    password.minLength = signup ? 8 : 0;
    dialog.querySelector('#aw-signin').textContent = busy ? 'Please wait…' : signup ? 'Create account' : retrySignIn ? 'Retry' : 'Sign in';
    dialog.querySelector('#aw-account-help').textContent = signup ?
      'Use at least 8 characters. Creating an account does not grant development-team access.' :
      'Use your AI-Wise account. Your Supabase dashboard account is separate.';
    resend.hidden = signup;
    signOutButton.hidden = !value.user;
    refreshButton.hidden = !['error', 'access-error', 'setup-needed'].includes(value.status);
    for (const control of [...form.elements, ...modeButtons, refreshButton, signOutButton]) {
      control.disabled = busy || value.status === 'checking';
    }
    if (!signup) confirmPassword.disabled = true;
    resend.disabled ||= Date.now() < resendAfter;
    resend.textContent = Date.now() < resendAfter ? 'Please wait before resending' : 'Resend confirmation';
  }
  function closeNow() {
    cancelClose?.(); cancelClose = null; window.AIWiseMotion.cancel(dialog);
    dialog.close(); password.value = ''; confirmPassword.value = ''; error.textContent = '';
    document.querySelector('.sidebar-rail button')?.focus({preventScroll: true});
  }
  function close() {
    if (!dialog.open || cancelClose) return;
    if (window.AIWiseMotion.reduced()) { closeNow(); return; }
    dialog.style.setProperty('--aw-enter-duration', 'var(--aw-motion-page)');
    dialog.classList.add('aw-leaving');
    cancelClose = window.AIWiseMotion.after(dialog, closeNow);
  }
  function open() {
    window.AIWiseSidebar.close(false);
    cancelClose?.(); cancelClose = null; window.AIWiseMotion.cancel(dialog);
    error.textContent = ''; retrySignIn = false; paint(state);
    dialog.showModal(); window.AIWiseMotion.enter(dialog);
    if (state.user && !busy) window.AIWiseAuth.refresh();
    if (!state.user && !email.disabled) email.focus({preventScroll: true});
    else dialog.querySelector('.aw-account-close').focus({preventScroll: true});
  }
  trigger.addEventListener('click', open);
  dialog.querySelector('.aw-account-close').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  const outside = event => { const r = dialog.getBoundingClientRect(); return event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom; };
  let backdropDown = false;
  dialog.addEventListener('pointerdown', event => { backdropDown = event.target === dialog && outside(event); });
  dialog.addEventListener('click', event => { if (backdropDown && event.target === dialog && outside(event)) close(); backdropDown = false; });
  async function action(fn, isSignIn = false) {
    if (busy) return;
    busy = true; retrySignIn = false; error.textContent = ''; paint(state);
    try { await fn(); }
    catch (failure) { retrySignIn = isSignIn; error.textContent = failure.message || 'Account action failed. Please try again.'; }
    finally { busy = false; password.value = ''; confirmPassword.value = ''; paint(window.AIWiseAuth.snapshot()); }
  }
  modeButtons[0].addEventListener('click', () => setMode('signin'));
  modeButtons[1].addEventListener('click', () => setMode('signup'));
  [password, confirmPassword].forEach(input => input.addEventListener('input', () => confirmPassword.setCustomValidity('')));
  form.addEventListener('submit', event => {
    event.preventDefault();
    const loginEmail = email.value, loginPassword = password.value;
    if (mode === 'signup' && loginPassword !== confirmPassword.value) {
      confirmPassword.setCustomValidity('Passwords do not match.'); confirmPassword.reportValidity(); return;
    }
    if (mode === 'signup') action(async () => {
      const result = await window.AIWiseAuth.signUp(loginEmail, loginPassword);
      mode = 'signin';
      if (result.confirmationRequired) {
        cooldown();
        showNotice('If this address can be registered, check your inbox and spam folder for a confirmation link, then sign in. If you already have an account, sign in with your existing password. Team access requires administrator approval.');
      }
    });
    else action(async () => { await window.AIWiseAuth.signIn(loginEmail, loginPassword); showNotice(''); }, true);
  });
  resend.addEventListener('click', () => {
    if (!email.reportValidity()) return;
    action(async () => {
      await window.AIWiseAuth.resendConfirmation(email.value);
      cooldown(); showNotice('If this account needs confirmation, check your inbox and spam folder for a new link.');
    });
  });
  signOutButton.addEventListener('click', () => action(() => window.AIWiseAuth.signOut()));
  refreshButton.addEventListener('click', () => action(() => window.AIWiseAuth.refresh()));
  window.AIWiseAuth.subscribe(paint);
  const url = new URL(location.href);
  if (url.searchParams.get('account') === 'signin') {
    url.searchParams.delete('account');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    open();
  }
})();
