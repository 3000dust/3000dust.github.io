# Flight History maintenance

The map is embedded in `_pages/life.md` with `{% include flight-history.html %}`. The include loads static assets from `assets/js/flight-map.js` and `assets/css/flight-map.css` directly; there is no iframe. It can show OpenStreetMap tiles when the network allows them, and has a bundled world-boundary fallback if map tiles are unavailable.

To add a flight, edit only `assets/data/flights.csv`: `date,from,to,note`. One row per leg; return flights and repeat dates are separate curves. Use `YYYY-MM-DD` dates, although Excel-style `M/D/YYYY` is also supported. Existing airport codes work without any code changes; to add an airport outside the built-in dictionary in `assets/js/flight-map.js`, add its coordinates there.

For troubleshooting: load `/assets/data/flights.csv`, `/assets/js/flight-map.js`, and `/assets/css/flight-map.css` directly in the browser to confirm they are not 404s. The JavaScript marks the map root with `data-ready="true"` after reading flights. The year selector should become enabled. The map renders 69 records as of the November 2026 dataset, including 9 flights recorded in 2026.
