/* Authentication and membership lookup only; existing local editors stay local. */
(() => {
  'use strict';
  const confirmationUrl = new URL('auth-confirm.html', document.currentScript.src).href;
  let state = {status: 'checking', user: null, message: 'Checking your account…'};
  let clientPromise, revision = 0, changing = false, refreshTimer;
  const listeners = new Set();
  function snapshot() { return {...state, user: state.user ? {...state.user} : null}; }
  function set(next) { state = next; listeners.forEach(fn => fn(snapshot())); }
  const signedOut = () => ({status: 'signed-out', user: null, message: 'Sign in with your AI-Wise workspace account.'});
  async function client() {
    if (!clientPromise) {
      clientPromise = window.AIWiseBackend.getClient().then(value => {
        // Do not call async Auth methods inside this callback: the SDK holds a lock.
        value.auth.onAuthStateChange(event => {
          if (event === 'SIGNED_OUT') { revision++; set(signedOut()); return; }
          if (changing || event === 'INITIAL_SESSION') return;
          clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, 0);
        });
        return value;
      }).catch(error => { clientPromise = null; throw error; });
    }
    return clientPromise;
  }
  function normalizeName(value) {
    const name = typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/g, ' ') : '';
    if (!name || [...name].length > 50 || /[\u0000-\u001f\u007f]/.test(name))
      throw new Error('Enter a display name using 1–50 characters.');
    return name;
  }
  function displayName(user) {
    try { return normalizeName(user.user_metadata?.display_name); } catch { return ''; }
  }
  async function refresh() {
    const current = ++revision;
    const apply = next => { if (current === revision) set(next); };
    apply({status: 'checking', user: state.user, message: 'Checking your account and team access…'});
    try {
      const backend = await client();
      const session = await backend.auth.getSession();
      if (session.error) throw session.error;
      if (!session.data.session) { apply(signedOut()); return; }
      // Validate identity with Auth, rather than trusting browser-stored user data.
      const verified = await backend.auth.getUser();
      if (verified.error) throw verified.error;
      if (!verified.data.user) { apply(signedOut()); return; }
      const user = {id: verified.data.user.id, email: verified.data.user.email || '', displayName: displayName(verified.data.user), name: displayName(verified.data.user)};
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      let result;
      try {
        result = await backend.from('workspace_members').select('user_id,active')
          .eq('user_id', user.id).eq('active', true).maybeSingle().abortSignal(controller.signal);
      } finally { clearTimeout(timeout); }
      if (result.error) {
        const setup = ['PGRST205', '42P01', '42501'].includes(result.error.code);
        apply({status: setup ? 'setup-needed' : 'access-error', user,
          message: setup ? 'Signed in. Team access setup is not ready yet. Ask the project administrator to complete it.' :
            'Signed in, but team access could not be checked. Check your connection and try again.'});
        return;
      }
      const member = result.data?.user_id === user.id && result.data.active === true;
      apply({status: member ? 'member' : 'not-member', user,
        message: member ? 'Your development-team membership is verified.' :
          'Awaiting administrator approval. Ask your project administrator to enable development-team access. Reopen this window to check for approval.'});
    } catch (error) {
      apply({status: 'error', user: null, message: error.status === 401 || error.status === 403 ?
        'Your session is no longer valid. Sign in again.' : 'Account check unavailable. Check your connection and try again.'});
    }
  }
  async function signIn(email, password) {
    if (changing) throw new Error('An account action is already in progress.');
    changing = true; revision++; clearTimeout(refreshTimer);
    try {
      const backend = await client();
      const {error} = await backend.auth.signInWithPassword({email: email.trim(), password});
      if (error) {
        if (error.code === 'invalid_credentials') throw new Error('Email or password is incorrect. Use your workspace account, not your Supabase dashboard account.');
        if (error.code === 'email_not_confirmed') throw new Error('Confirm your email before signing in. Check your inbox or select Resend confirmation.');
        if (error.status === 429) throw new Error('Too many sign-in attempts. Please wait before trying again.');
        throw new Error('Sign-in failed. Check your connection and account details, then try again.');
      }
    } finally { changing = false; }
    await refresh();
  }
  function registrationError(error) {
    if (error.code === 'signup_disabled') return new Error('Account registration is currently disabled. Contact your project administrator.');
    if (error.status === 429) return new Error('Too many requests. Please wait before trying again.');
    if (error.code === 'email_address_not_authorized') return new Error('Confirmation email delivery is not enabled for this address. Ask your project administrator to configure email delivery.');
    if (error.code === 'weak_password') return new Error('Choose a stronger password that meets the project password policy.');
    if (error.code === 'email_address_invalid' || error.code === 'validation_failed') return new Error('Check your email address and password, then try again.');
    if (error.code === 'user_already_exists' || error.code === 'email_exists') return new Error('Try signing in or checking your confirmation email instead.');
    return new Error('The request could not be completed. Check your connection or contact your project administrator.');
  }
  async function signUp(email, password, name) {
    if (changing) throw new Error('An account action is already in progress.');
    if (state.user) throw new Error('Sign out before creating another account.');
    const normalizedName = normalizeName(name);
    if (password.length < 8) throw new Error('Use at least 8 characters for your password.');
    changing = true; revision++; clearTimeout(refreshTimer);
    let hasSession = false;
    try {
      const backend = await client();
      const {data, error} = await backend.auth.signUp({email: email.trim(), password,
        options: {emailRedirectTo: confirmationUrl, data: {display_name: normalizedName}}});
      if (error) throw registrationError(error);
      hasSession = !!data.session;
      // Registration never writes workspace_members or supplies role metadata.
    } finally { changing = false; }
    if (hasSession) await refresh();
    return {confirmationRequired: !hasSession};
  }
  async function updateDisplayName(name) {
    if (changing) throw new Error('An account action is already in progress.');
    if (!state.user || state.status === 'checking') throw new Error('Sign in before changing your display name.');
    const normalizedName = normalizeName(name), userId = state.user.id;
    changing = true; revision++; clearTimeout(refreshTimer);
    try {
      const backend = await client();
      const verified = await backend.auth.getUser();
      if (verified.error || verified.data.user?.id !== userId) throw new Error('Your account session has changed. Reopen this window and sign in again.');
      const {data, error} = await backend.auth.updateUser({data: {display_name: normalizedName}});
      if (error) throw new Error(error.status === 429 ? 'Too many requests. Please wait before trying again.' :
        'Your name could not be saved. Check your connection and try again.');
      if (state.user?.id !== userId || data.user?.id !== userId || displayName(data.user) !== normalizedName)
        throw new Error('The saved name could not be confirmed. Reopen this window to check your account.');
      // Display metadata is never used for membership or authorization.
      set({...state, user: {...state.user, displayName: displayName(data.user), name: displayName(data.user)}});
      return normalizedName;
    } finally { changing = false; }
  }
  async function resendConfirmation(email) {
    if (changing) throw new Error('An account action is already in progress.');
    changing = true;
    try {
      const backend = await client();
      const {error} = await backend.auth.resend({type: 'signup', email: email.trim(),
        options: {emailRedirectTo: confirmationUrl}});
      if (error) throw registrationError(error);
    } finally { changing = false; }
  }
  async function signOut() {
    if (changing) throw new Error('An account action is already in progress.');
    changing = true; revision++; clearTimeout(refreshTimer);
    try {
      const backend = await client();
      const {error} = await backend.auth.signOut({scope: 'local'});
      if (error) throw new Error('Sign-out could not be completed. Check your connection and try again.');
      set(signedOut());
    } finally { changing = false; }
  }
  window.AIWiseAuth = Object.freeze({snapshot, refresh, signIn, signOut, signUp, resendConfirmation, updateDisplayName,
    subscribe(fn) { listeners.add(fn); fn(snapshot()); return () => listeners.delete(fn); }});
  // Recheck revocation on return. Future data access must also be enforced by RLS.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.user && !changing) refresh();
  });
  refresh();
})();
