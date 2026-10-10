# Kiosk Dashboard - Task 1-4 update

- Production CSV/XLSX export reads all production entries from PostgreSQL.
- Export includes Colour, Rubber Compound, Compound Received (kg), Compound Used (kg), and Compound Balance (kg).
- Existing production rows are backfilled with colour from product suffix and rubber compound from the Part Master where possible.
- Existing database schema is migrated automatically for the new compound fields.
- Dashboard kiosk form also supports product-dependent compound selection and compound quantity tracking.
- The Part Master already contains `rubber_compound` from the supplied Part n Mold data.xlsx.
- Future master-data CRUD should use the PostgreSQL mold/part master as the source of truth rather than hard-coded app data.
