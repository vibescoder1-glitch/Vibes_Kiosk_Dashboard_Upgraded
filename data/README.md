# Mold and product master data

`mold-part-master.json` was generated from the supplied `Part n Mold data.xlsx`.

- 246 mold rows
- 222 part rows used for the application master
- Mold selection resolves the mold family.
- Product suggestions are then limited to parts in that family.
- Plant values are normalized only when the source explicitly says Plant 1, Plant 2, or Plant 3. Other supplier/manufacturer values are retained as unassigned rather than being treated as plants.

To refresh the MySQL master data after `npm run db:setup`, run:

`npm run db:import-mold-data`

The import replaces the existing `molds` and `parts` master records. Production history, operators, machines, tasks, schedules, and kiosk records are not modified by this import.
