# Dashboard - Requested Production Changes

- Production task Target Shots auto-fill from the selected mold's Shot Target master data.
- Server-side task creation also derives Target Shots from the mold master when no target is supplied.
- Production reports show rejection rate as Rejected Quantity / Total Produced Quantity x 100, with Total Produced = OK + Rejected + Scrap.
- Production reports show target-shot achievement using Actual Shots / Target Shots x 100.
- Production reports show target-based OEE using Availability x Performance x Quality.
  - Availability = (Planned Minutes - Downtime Minutes) / Planned Minutes.
  - Performance = Actual Shots / Target Shots.
  - Quality = OK Quantity / Total Produced Quantity.
- Production history details show rejection rate.
- Common active operators across plants remain supported.
