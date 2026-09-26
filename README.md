# NotaBene

A small, serverless piano practice planner designed for an iPad next to the piano. The static website can be hosted on GitHub Pages; practice records are stored locally in the browser on that iPad. The app interface is in German.

## Files

- `index.html`: User interface
- `style.css`: Styling
- `app.js`: Calendar, scheduling, daily duration totals, storage, and backup
- `stuecke.json`: Repertoire; edit your existing file to add durations

All four files must be in the **same directory**. Do not open `index.html` directly using a `file://` URL: the app loads `stuecke.json` with `fetch` and needs to be served as a website, for example through GitHub Pages.

## Publish on GitHub Pages

1. Create a free GitHub account, or use an existing one.
2. Create a **public** repository, such as `NotaBene`. The source code and repertoire JSON in a public repository are visible to everyone; practice records stored locally on your iPad are not uploaded to GitHub.
3. Upload the four files to the root of the repository. Keep their filenames exactly as shown above.
4. In the repository settings, open **Pages**, select deployment from the `main` branch and the `/ (root)` directory, then save.
5. Open the GitHub Pages address shown there in Safari on your iPad. If the site is not immediately available, wait a moment and reload it.
6. Use Safari’s Share menu to choose **Add to Home Screen**; enable **Open as Web App** if offered. From then on, open NotaBene using that Home Screen icon. A Home Screen web app and Safari may use separate storage.

To change your repertoire, edit `stuecke.json` in your GitHub repository and reload the website. Every piece needs a unique, stable `id`. Do not change an existing piece’s `id` after logging practice, or its previous entries will no longer appear under that piece. Changing a piece’s interval or first due date later will also change historical *calculated* due/overdue labels; actual practice dates remain stored.

## Repertoire format

```json
[
  {
    "id": "bach-bwv-847",
    "titel": "Präludium und Fuge c-Moll",
    "werknummer": "BWV 847",
    "tonart": "c-Moll",
    "intervallTage": 3,
    "ersterTermin": "2026-09-25",
    "dauerMinuten": 15
  }
]
```

`ersterTermin` uses the `YYYY-MM-DD` format; `intervallTage` is a positive integer. `dauerMinuten` is the estimated practice time for **one session** of that piece, in whole minutes. This field is optional for compatibility with older repertoire files: if omitted, that piece contributes 0 minutes to daily totals. An `id` must be unique and contain only lowercase ASCII letters, digits, hyphens, and underscores; it must start with a letter or digit. To add a piece, add another JSON object, separating objects with commas. The app uses the iPad’s local calendar date for “today.”

## Scheduling and daily totals

- A piece is due on its first due date unless it has already been practiced.
- After a practice session, the next due date is `intervallTage` calendar days later.
- If a due date is missed, the piece stays marked overdue each day until it is actually practiced. Missed sessions are not added up or moved forward automatically.
- Past cells show their status based on the recorded practice dates. Only today’s cell can be clicked. Today’s practice entry can be undone on the same day.
- Future “Geplant” (planned) labels are provisional. If a piece is already due or overdue today, the preview assumes a possible session tomorrow; the real schedule resets only when you check off a session.
- The bottom **Tagesdauer** row sums estimated minutes per day: past days count **only pieces actually practiced**; today counts **all pieces practiced, due, or overdue** (the amount of time required to complete today’s list); future days count **only pieces marked Geplant**. These are estimates from the *current* `stuecke.json`, not measured durations or immutable historical records. Changing `dauerMinuten` changes previous totals too.

## Backups and limitations

Use **“Backup exportieren”** regularly and keep the downloaded JSON file outside the app. **“Backup importieren”** replaces all local practice records with the backup after confirmation; it does not change the repertoire. Clearing website data, reinstalling the app, or moving to another device can erase local practice records. Avoid private browsing. This release is **not** configured for offline use: loading or updating it requires an internet connection. Changing the website address or switching between the Home Screen icon and Safari may show different local records; import a backup if needed.

The app has not been automatically tested on an iPad. After publishing it, try checking and unchecking a practice entry, then exporting and importing a test backup.