/**
 * The Google scopes Googol Vibe asks for, kept in one place.
 *
 * BASIC says who is signed in: `openid` and `email` give the account's email
 * address (shown as the connected account), and `profile` gives the name and
 * picture.
 *
 * DATA is what the dashboard uses. Gmail, Calendar and Drive are read-only.
 * Tasks is the full scope, not tasks.readonly, because the app creates, edits,
 * completes and deletes tasks.
 */
const BASIC = ['openid', 'email', 'profile'];

const DATA = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/tasks',
];

/** One sign-in asks for both sets, until onboarding asks for DATA in a later step. */
const SIGN_IN = [...BASIC, ...DATA];

module.exports = { BASIC, DATA, SIGN_IN };
