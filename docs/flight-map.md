# Flight History map (Beyond Research)

This interactive map is included only on the Beyond Research page, immediately above Road Trips.
It is a static D3 world map: no user account, map API key, or backend is required.

## How to add a flight

Edit **_data/flights.csv**, keeping the header exactly:

~~~csv
date,from,to,note
2026-07-12,BWI,BOS,Example conference trip
2026-07-16,BOS,BWI,Example return flight
2025-12-01,IAD,LHR,Example international trip
~~~

These rows are **examples only** and are not published as real flight records.
The real CSV currently contains only the header, so the initial live map is empty.

* Add one row for each flight leg. Connecting and return flights each need a row.
* Date format: YYYY-MM-DD. Use the three-letter **airport IATA code** (BWI, IAD, LHR, etc.).
* The note field is optional. Enclose any note containing a comma in double quotation marks.
* Commit the CSV to GitHub. The year menu, routes, and totals update automatically when the site rebuilds.
* Multiple flights on one airport pair produce one selectable curve showing all matching records.
* Route paths and displayed distance are great-circle estimates, not actual tracked aircraft paths.
* Avoid publishing future bookings if you want to keep upcoming travel private.

## Files

* **_pages/life.md** — inserts a section before Road Trips.
* **_includes/flight-map.html** — HTML widget and script imports.
* **assets/css/flight-map.css** — scoped styles.
* **assets/js/flight-map.js** — routes, filtering, zooming, details.
* **assets/data/flight-airports.json** — local coordinates and names for 4,008 IATA airports.
* **_data/flights.csv** — edit this file whenever you add a flight.

The airport coordinates are a compact CC0 snapshot of the
[tine-current/airport-codes dataset](https://github.com/tine-current/airport-codes),
based on OurAirports and Wikidata. If an airport code is missing, manually add
it in assets/data/flight-airports.json as:
**"ABC": [latitude, longitude, "Airport Name"]**.

World map boundaries come from the
[world-atlas v2.0.2](https://github.com/topojson/world-atlas) CDN package
(Natural Earth data). Browser libraries: D3 7.9.0 and topojson-client 3.1.0.

## To preview

Locally, run \`bundle exec jekyll serve\` in the repository root and visit
http://127.0.0.1:4000/life/.
After review, merge the feature branch into master to publish on GitHub Pages.
