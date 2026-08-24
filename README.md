# 💌 Interactive Letter with Google Sheets

A Valentine's-style interactive letter that opens with a password. Google Apps Script validates the password and selects the message server-side, so neither the password nor the spreadsheet are exposed to visitors.

## Features

- 🔐 Password validation outside the browser
- 📅 Special messages for specific dates
- 🎲 Random messages when there is no special date
- ☁️ Content managed in a private Google Sheet
- ❤️ Animations and floating hearts
- 🔄 A new message loads each time the letter opens
- 🔁 Pressing **OPEN** again while the letter is open refreshes random messages without asking for the password again

## Architecture

```text
Browser → Apps Script web app → Private Google Sheet
```

The browser only receives a successful response and the selected message. It never receives the spreadsheet ID, sheet contents, or shared password. After a successful password check, it stores an opaque, server-validated session token for the current browser tab. The token expires after 30 minutes, so opening another message after `RESET` does not require re-entering the password.

## Google Sheet Structure

Keep the spreadsheet private. The selected sheet must use these columns:

| Column | Description |
|-------|-------------|
| A | Date (`DD/MM/YYYY`) |
| B | Special message for that date |
| C | Random message |

| A | B | C |
|--|--|--|
| 14/02/2026 | Happy Valentine's Day 💖 | I think about you a lot |
| 15/02/2026 | Another special message | You are amazing |

## Deploy the Apps Script

1. Open [Apps Script](https://script.new) while signed in with the Google account that owns the spreadsheet.
2. Replace the default file contents with [`apps-script/Code.gs`](apps-script/Code.gs).
3. In **Project Settings → Script properties**, add these values:

   | Property | Value |
   |----------|-------|
   | `SPREADSHEET_ID` | The ID from the private spreadsheet URL |
   | `LETTER_PASSWORD` | A long, unique shared password |
   | `SHEET_NAME` | Optional; defaults to `Sheet1` |

4. Confirm the spreadsheet is not published to the web and that the deploying Google account can open it.
5. Select **Deploy → New deployment → Web app**.
6. Set **Execute as** to **Me** and **Who has access** to **Anyone**. This makes the endpoint reachable by the page; it does not grant access to the sheet or password.
7. Authorize the requested permissions, deploy, and copy the URL ending in `/exec`.
8. In [`script.js`](script.js), replace `PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` with that `/exec` URL.

After changing `Code.gs`, create a new Apps Script deployment version and keep the same `/exec` URL. Never add the script properties or the deployment URL's administrative settings to the repository.

The default authorization session expires after 30 minutes. To change that duration, update `SESSION_TTL_SECONDS` in `Code.gs`, then deploy a new version.

## Local Verification

The client has no build step. Check its syntax with:

```sh
node --check script.js
```

Test these cases after deployment:

1. Correct password: the letter opens and shows a message.
2. Incorrect or empty password: the letter remains closed.
3. A date without a special message: a random message appears.
4. A malformed or empty sheet: the service returns a generic error without exposing details.
