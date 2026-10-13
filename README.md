**Nexora**
**Live Demo**
https://ahmadeccountant.github.io/Nexora/
**Plan smarter. Deliver better.**

Nexora is a portfolio-grade project management app built with plain HTML5, CSS3 and vanilla JavaScript (ES modules). It behaves like a real productivity tool — projects, tasks, a drag-and-drop Kanban board, analytics, search, notifications, theming, CSV export and JSON backup/restore — but it is a **frontend-only demo**. All data is fictional and is stored in your browser's LocalStorage.

## Features

- **Overview dashboard**: KPI cards (total/active projects, open, overdue and completed tasks, completion rate), project progress, status and priority charts, weekly productivity, upcoming deadlines, recent activity, and quick actions. Every number is calculated from current data.
- **Projects**: create, edit, view details, archive/restore, delete, search, filter (status, owner) and sort. Progress is calculated from each project's tasks. Due dates earlier than start dates are rejected.
- **Tasks (My Tasks)**: full CRUD, assignment, status, priority, due date, tags, search, filters (project, status, priority, assignee), sorting, one-click completion and a details dialog.
- **Kanban board**: To Do / In Progress / In Review / Done columns with HTML5 drag-and-drop. Each card also has a "Move to" menu, so the board works with a keyboard and on touch screens.
- **Team**: six fictional members with assigned, completed and overdue counts derived from tasks.
- **Analytics**: status, priority, project progress, weekly completion, overdue and team workload charts with a date-range filter.
- **Activity feed**: recorded only when something actually changes (create, edit, delete, archive, complete, move, reassign).
- **Global search and notifications**: search projects and tasks from the top bar (press `/` to focus it); notifications are built from overdue and soon-due local data and can be marked as read. No emails or push messages are ever sent.
- **Settings**: light/dark theme, display name, default My Tasks view, CSV exports, JSON backup, validated restore, and reset to demo data.
- **Quality**: semantic HTML, labelled forms with inline validation, focus management in dialogs, visible focus states, status never conveyed by colour alone, safe text rendering (user input is never parsed as HTML), reduced-motion support, and responsive desktop/tablet/mobile layouts.

## Technologies

| Area | Choice |
| --- | --- |
| Markup and styles | HTML5, CSS3 (custom properties, grid, flexbox) |
| Logic | Vanilla JavaScript with native ES modules (no framework, no build step) |
| Charts | [Chart.js 4.4.7](https://www.chartjs.org/) from a pinned jsDelivr URL |
| Icons | [Lucide 0.469.0](https://lucide.dev/) from a pinned unpkg URL |
| Font | Plus Jakarta Sans (Google Fonts) with a system-font fallback |
| Persistence | Browser LocalStorage |

If the CDN scripts fail to load (for example when offline) the app still works: charts show a text summary and icons are simply omitted.

## Folder structure

```
nexora/
  index.html
  README.md
  .gitignore
  assets/images/
  css/
    variables.css   design tokens and light/dark themes
    base.css        reset and global defaults
    layout.css      sidebar, topbar, grids
    components.css  buttons, cards, badges, forms, modals, toasts, tables
    pages.css       page-specific layouts
    responsive.css  tablet and mobile breakpoints
  js/
    app.js          startup, routing, re-rendering
    state.js        central state and all mutations (+ activity logging)
    storage.js      versioned LocalStorage, validation, migration
    router.js       hash router (#/projects/project_001)
    shell.js        page title, active nav, mobile drawer, storage banner
    selectors.js    pure functions: filters, sorting, KPIs, chart data, notifications
    validation.js   project and task input validation
    utils.js        ids, dates, DOM builder, downloads
    components/     modal, toast, dropdown, form, charts, ui, options
    features/       dashboard, projects, tasks, kanban, analytics, team,
                    settings, activity, search, notifications
    data/           seed.js, constants.js
    services/       export.js (CSV and JSON)
```

## Run locally

ES modules are blocked by browsers when a page is opened with `file://`, so serve the folder over HTTP:

```bash
cd nexora
python3 -m http.server 8000      # or: npx serve .
```

Then open <http://localhost:8000>. With VS Code you can use the Live Server extension instead.

An internet connection is needed for the fonts, Chart.js and Lucide (all loaded from CDNs).

## Data storage and limitations

- Data lives in LocalStorage under the key `nexora.data` (schema version 1). It is saved after every change and **not** overwritten on refresh. Demo data is created only on first use.
- LocalStorage is per browser and per device, is not encrypted, and is removed when site data is cleared. There is **no authentication, no server and no multi-user sharing**; a backend would be needed for those.
- If LocalStorage is unavailable (some private modes) the app keeps working in memory and shows a warning that changes will not persist. If a save fails (for example the quota is full) a warning banner appears.
- If saved data is unreadable, the original text is kept under `nexora.data.corrupt-backup` and demo data is loaded.
- Archived projects keep their tasks, but those tasks are hidden from task views and excluded from dashboard and analytics metrics until the project is restored. **Deleting a project also deletes its tasks** (the confirmation dialog says how many).
- Native HTML5 drag-and-drop does not work on most touch screens; use the "Move to" menu on each card there.
- The Team page is demo data. Nexora does not send invitations or emails.
- The CDN scripts are version-pinned but do not use Subresource Integrity hashes. Add `integrity` attributes (or self-host the files) for a production deployment.

## Backup and restore

- **Settings → Download backup** saves everything as JSON.
- **Settings → Restore from JSON** validates the file first (structure, enums, dates, and that every project/task/member reference exists). If anything is wrong, an error list is shown and your current data is left untouched. A valid file asks for confirmation before replacing your data.
- CSV exports escape commas, quotes and line breaks, and neutralise cells that start with `=`, `+`, `-` or `@` so spreadsheets do not run them as formulas.

## Deploy (GitHub Pages or Netlify)

**GitHub Pages**

1. Push the `nexora` folder contents to a GitHub repository (so `index.html` is at the repository root).
2. Repository **Settings → Pages → Build and deployment**: choose *Deploy from a branch*, select `main` and `/ (root)`.
3. Open the published URL (a few minutes after the first push).

**Netlify**

1. Create a new site from your Git repository (or drag the folder onto Netlify Drop).
2. Leave the build command empty and set the publish directory to the folder containing `index.html`.

After deploying, open the live URL in a private/incognito window to confirm the first-visit demo data, then run through the checklist below on the live site.

## Testing checklist

- [ ] App starts from a local HTTP server with no console errors.
- [ ] All navigation items open the correct view; browser back/forward works.
- [ ] Create, edit, archive/restore and delete a project (delete asks for confirmation and names the tasks that will go with it).
- [ ] Create, edit, complete, assign, move and delete a task.
- [ ] Search, filters and sorting return the expected results, and "Clear filters" works.
- [ ] Kanban: drag a card to another column; use the "Move to" menu with the keyboard; refresh and confirm it persisted.
- [ ] Dashboard KPIs and charts change after you add, complete or delete tasks.
- [ ] Theme toggle works and survives a refresh.
- [ ] Download projects CSV, tasks CSV and a JSON backup.
- [ ] Restoring invalid JSON shows errors and keeps current data; restoring the downloaded backup works.
- [ ] Reset to demo data asks for confirmation.
- [ ] Forms show clear messages (empty name/title, due date before start date).
- [ ] No horizontal page scrolling at 375 px, 768 px and desktop widths.
- [ ] Tab through the app: focus is always visible, dialogs trap focus, Escape closes dialogs and menus.
**live Demo**
https://ahmadeccountant.github.io/Nexora/
