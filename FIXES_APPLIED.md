# Export, Mold Master, Product and Colour Fixes

- All 246 mold-master records from `Part n Mold data.xlsx` are retained and the kiosk suggestion list no longer truncates to 60.
- Product becomes a select dropdown when the selected mold family has multiple part numbers.
- Colour is derived from the standard part-number colour suffix and saved with production entries.
- Existing blank colours are backfilled from the product number on application startup.
- Production CSV and Excel exports read all central PostgreSQL production entries and include 27 requested fields, including Colour.
- PostgreSQL-compatible export date filters are used.
