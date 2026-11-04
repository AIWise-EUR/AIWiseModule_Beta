/* Writes only through the administrator-checked canonical registry endpoint. */
(() => {
  'use strict';
  let revision = 0, refreshPromise;
  const auth = () => window.AIWiseAuth.snapshot();
  const messages = {
    setup_required: 'Shared course registration needs server setup. Ask the administrator to deploy workspace-courses. Your details are still here.',
    administrator_required: 'An active administrator account is required to register courses.',
    sign_in_required: 'Sign in again before registering this course.',
    bachelor_required: 'Select the bachelor this course belongs to.', unknown_bachelor: 'This bachelor is no longer available. Refresh the shared list.',
    invalid_course_id: 'Course ID: use lowercase letters, numbers and hyphens, starting with a letter (maximum 40 characters).',
    invalid_short_name: 'Enter a short name using 1–40 characters.', invalid_course_name: 'Enter a full course name using 1–160 characters.',
    course_exists: 'This course ID is already registered in this bachelor. Open that course to edit its names.',
    course_missing: 'This course is no longer in the shared list. Your entered details are preserved.',
    registry_conflict: 'The shared list changed. Select Refresh shared list, review the bachelor and names, then save again. Your entered details are preserved.',
    refresh_required: 'Refresh the shared list before saving.',
    save_unconfirmed: 'The save could not be confirmed. Retry with these same details to check safely.',
  };
  async function call(body) {
    const start = auth(), generation = revision;
    if (start.status !== 'member' || start.role !== 'admin' || !start.user?.id) throw Error(messages.administrator_required);
    const client = await window.AIWiseBackend.getClient();
    const current = () => { const a = auth(); return generation === revision && a.status === 'member' && a.role === 'admin' && a.user?.id === start.user.id; };
    if (!current()) throw Error('Your account changed. Reopen this screen.');
    const {data, error} = await client.functions.invoke('workspace-courses', {body, timeout: 75000});
    if (!current()) throw Error('Your account changed. Reopen this screen to check the shared list.');
    let response = data;
    if (error?.context?.json) try { response = await error.context.json(); } catch { /* Non-JSON gateway error. */ }
    if (error || response?.ok !== true) {
      const status=error?.context?.status;
      const code = status === 404 ? 'setup_required' : status === 401 ? 'sign_in_required' : status === 403 ? 'administrator_required' : response?.code;
      throw Object.assign(Error(messages[code] || 'The course registration service could not be reached. It may be undeployed, or its connection may be blocked. Ask the administrator to check workspace-courses in Supabase. The last loaded course list is still available and your entered details are preserved.'), {field: response?.field || ''});
    }
    if (response.capability !== 'workspace-courses-v1' || (!/^[a-f0-9]{40}$/.test(response.sha) || (response.commit !== null && !/^[a-f0-9]{40}$/.test(response.commit)))) throw Error('The shared course service needs an update. Your details are preserved.');
    window.AIWiseCourseRegistry.use(response.registry);
    window.dispatchEvent(new Event('aiwise:courses-changed'));
    return response;
  }
  function refresh() {
    if (!refreshPromise) refreshPromise = call({action: 'load'}).finally(() => { refreshPromise = null; });
    return refreshPromise;
  }
  let identity = '';
  window.AIWiseAuth.subscribe(state => {
    const next = state.status === 'member' && state.role === 'admin' ? state.user?.id || '' : '';
    if (next !== identity) { revision++; identity = next; refreshPromise = null; }
  });
  window.AIWiseSharedCourses = Object.freeze({refresh, save: (action, course, sha) => call({action, course, expected_sha: sha})});
})();
