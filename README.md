# Finance Tracker

A small, manual, no-build personal finance tracker. Add your monthly wages,
log your expenses, and see your balance per month — all stored locally in
your browser. There is no server, no account, and no automatic syncing;
everything is entered by hand.

## Running it

There's nothing to install or build. Just open `index.html` in a browser,
or serve the folder with any static file server, for example:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

### On an iPhone

The layout is responsive and works directly in Safari. To use it like an
app:

1. Host the folder somewhere reachable from your phone (e.g. enable
   **GitHub Pages** for this repo, or run a local server on your network).
2. Open the page in Safari.
3. Tap the Share icon → **Add to Home Screen**.

It will launch full-screen with its own icon, just like a native app.

## Features

- Add wages (date, source, amount).
- Add expenses (date, category, description, amount).
- Monthly summary: wages, expenses, balance, and an all-time balance.
- Spending-by-category breakdown for the selected month.
- Delete any transaction.
- Data is stored only in your browser's local storage on that device —
  nothing is uploaded anywhere.

## Notes

- Data is per-browser/per-device (local storage). There is intentionally
  no import/export step — everything is entered manually.
- Clearing your browser's site data for this page will erase your history.
