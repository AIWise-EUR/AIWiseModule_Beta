/* Authentication and membership lookup only; existing local editors stay local. */
(() => {
  'use strict';
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
          if (changing || event === 'INITIAL_SESSION') return;
          if (event === 'SIGNED_OUT') { revision++; set(signedOut()); }
          else { clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, 0); }
        });
        return value;
      }).catch(error => { clientPromise = null; throw error; });
    }
    return clientPromise;
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
      const user = {id: verified.data.user.id, email: verified.data.user.email || ''};
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
          'Signed in. This account has not been enabled for the development team. Contact the project administrator.'});
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
        if (error.code === 'email_not_confirmed') throw new Error('This account needs email confirmation. Contact the project administrator.');
        if (error.status === 429) throw new Error('Too many sign-in attempts. Please wait before trying again.');
        throw new Error('Sign-in failed. Check your connection and account details, then try again.');
      }
    } finally { changing = false; }
    await refresh();
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
  window.AIWiseAuth = Object.freeze({snapshot, refresh, signIn, signOut,
    subscribe(fn) { listeners.add(fn); fn(snapshot()); return () => listeners.delete(fn); }});
  // Recheck revocation on return. Future data access must also be enforced by RLS.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.user && !changing) refresh();
  });
  refresh();
})();
