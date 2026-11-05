# MEG ERP + Order Hub (React, frontend only)

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

No backend or database is needed. Data is saved in the browser (localStorage).

Sign in with a demo account, or use the **Register** tab to create your own:

| Role | Username | Password |
|---|---|---|
| ERP Administrator | admin | Admin@123 |
| Admin / Back office | backoffice | Office@123 |
| Area Manager | priya / tom | Priya@123 / Tom@123 |
| Client | spice / greenleaf / alnoor / riverside | Spice@123 / Green@123 / Alnoor@123 / River@123 |

Admin / ERP Administrator self-registration needs the access code `MEG-ADMIN-2026` (change it in `src/data/authStore.js`).

See `README.md` for the full project guide.
