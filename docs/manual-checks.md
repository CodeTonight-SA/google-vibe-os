# Manual checks

GitHub Actions cannot run for this repository at present, so every change is
checked on a real machine before it merges. Run the automatic checks first,
then the manual checks for the part you changed, on each platform you can.
Record the result in the pull request: the platform, the date, and pass or
fail for each step.

## Automatic checks

From `dashboard/`:

```bash
npm run verify
```

This runs the renderer and Electron test suites, ESLint and the production
build. ESLint fails only on errors that are not recorded in
`eslint-suppressions.json`. After you fix a recorded error, run
`npx eslint . --prune-suppressions` and commit the smaller file.

## Sign-in through the system browser

You need a Desktop OAuth client file at `~/.googol-vibe/credentials.json`
(its top-level key is `installed`). Start signed out: use Sign out in the
app, or move `~/.googol-vibe/tokens/token_electron.json` aside.

1. Start the app, go to the Connect step and click Connect.
2. Check that Google's consent page opens in your default browser, not in a
   window of the app, and that the address bar shows `accounts.google.com`.
3. Approve. Check that the browser tab says "You are signed in", and that
   the app comes back to the front and shows the email address of the
   account you signed in with.
4. Check that the app no longer listens for the callback. On macOS and Linux,
   `lsof -nP -a -iTCP -sTCP:LISTEN -c Googol` prints nothing. On Windows,
   `netstat -ano | findstr LISTENING` shows no line with the app's process ID.
5. Check that `main.log` contains no access token or refresh token. On macOS
   it is `~/Library/Logs/googol-vibe/main.log`.
6. Sign out. Check that `main.log` says `Google access revoked at sign-out: yes`,
   and that Googol Vibe no longer appears among the third-party apps at
   https://myaccount.google.com/permissions.
7. Click Connect, then click Cancel sign-in in the app without answering
   Google. Check that the app stops waiting at once, shows no error, and that
   Connect works again.
8. Click Connect and click Cancel on Google's page. Check that the app shows
   the error and that Connect works again.
9. Optional, it takes 5 minutes: click Connect and close the browser tab
   without answering. Check that the app reports that sign-in timed out and
   that Connect works again.

Notes for each platform:

- Windows and Linux use the same flow: the app opens the consent page with
  Electron's `shell.openExternal`, which uses the system's default browser.
  On Linux, `xdg-open` must have a default browser set.
- A Web OAuth client (top-level key `web`) keeps the redirect the old setup
  registered, `http://localhost:3000/oauth2callback`. Set
  `OAUTH_CALLBACK_PORT` if yours uses another port.
