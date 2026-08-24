# 💌 Interactive Letter with Google Sheets

A Valentine's-style interactive letter that opens only with a password 💖
The message content is loaded dynamically from **Google Sheets**, based on the current date.

---

## ✨ Features

- 🔐 Password-protected
- 📅 Special messages for specific dates
- 🎲 Random messages when there is no special date
- ☁️ Content managed through Google Sheets
- ❤️ Animations and floating hearts
- 🔄 A new message loads each time you press **OPEN**
- ❌ No backend
- ❌ No reset button
- ✅ Works with HTML + JavaScript only

---

## 🧠 How It Works

1. The user presses **OPEN**.
2. A password is requested.
3. The password is validated against Google Sheets.
4. If it is correct:
   - The current date is checked.
   - If it matches a date in the sheet, the special message is shown.
   - Otherwise, a random message is shown.
5. The letter opens and displays the message 💌

---

## 📊 Google Sheet Structure

The Google Sheet must be **published to the web** and use this structure:

| Column | Description |
|-------|-------------|
| A | Date (`DD/MM/YYYY`) |
| B | Special message for that date |
| C | Random message |
| D | Password (only the **first row** is used) |

### 📌 Example

| A | B | C | D |
|--|--|--|--|
| 14/02/2026 | Happy Valentine's Day 💖 | I think about you a lot | password |
| 15/02/2026 | Another special message | You are amazing | |
