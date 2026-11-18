<!-- Flight History widget for inclusion in the Beyond Research page.
     Data is read from assets/data/flights.csv; nothing else needs to be installed. -->

<style>
.flight-history { margin: 1.25rem 0 2rem; border: 1px solid #dce5ea; border-radius: 9px; background: #fff; overflow: hidden; font-family: inherit; font-size: .91em; }
.flight-history * { box-sizing: border-box; }
.flight-history__bar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: .65rem 1rem; padding: .78rem .95rem; border-bottom: 1px solid #e6edf1; }
.flight-history__control { display: flex; align-items: center; gap: .6rem; margin: 0; font-weight: 600; color: #455f6c; }
.flight-history__control select { min-width: 112px; width: auto; margin: 0; padding: .33rem .5rem; font: inherit; font-weight: 400; background: #fff; color: #2f5265; border: 1px solid #d0dbe1; border-radius: 5px; cursor: pointer; }
.flight-history__stats { display: flex; flex-wrap: wrap; gap: .35rem 1rem; color: #637781; font-size: .91em; }
.flight-history__stats strong { color: #285d74; font-variant-numeric: tabular-nums; }
.flight-history__canvas { height: 345px; position: relative; background: #f6f9fb; }
.flight-history__canvas svg { width: 100%; height: 100%; display: block; cursor: grab; touch-action: none; }
.flight-history__canvas svg:active { cursor: grabbing; }
.flight-history__ocean { fill: #f6f9fb; stroke: #d5e3e9; stroke-width: 1; }
.flight-history__grid { fill: none; stroke: #e5edf1; stroke-width: .65; pointer-events: none; }
.flight-history__land { fill: #e2e9ea; stroke: #c2d0d5; stroke-width: .6; stroke-linejoin: round; pointer-events: none; }
.flight-history__curve { fill: none; stroke: #287c9b; stroke-width: 2; stroke-opacity: .82; stroke-linecap: round; vector-effect: non-scaling-stroke; pointer-events: none; }
.flight-history__leg:hover .flight-history__curve, .flight-history__leg.is-active .flight-history__curve, .flight-history__leg:focus-within .flight-history__curve { stroke: #ce823b; stroke-width: 3.5; stroke-opacity: 1; }
.flight-history__hit { fill: none; stroke: transparent; stroke-width: 14; vector-effect: non-scaling-stroke; pointer-events: stroke; cursor: pointer; }
.flight-history__hit:focus-visible { stroke: rgba(204,130,59,.22); outline: none; }
.flight-history__airport { fill: #287c9b; stroke: #fff; stroke-width: 1.2; cursor: pointer; }
.flight-history__airport:focus-visible { stroke: #ce823b; stroke-width: 3; outline: none; }
.flight-history__zoom { display: flex; flex-direction: column; gap: 3px; position: absolute; top: 12px; right: 12px; }
.flight-history__zoom button { display: block; width: 30px; height: 30px; padding: 0; border: 1px solid #d1dee4; border-radius: 4px; background: #fff; color: #4f6876; font-size: 20px; line-height: 1; cursor: pointer; }
.flight-history__zoom button:hover { background: #eaf3f7; }
.flight-history__details { min-height: 2.2rem; padding: .7rem .95rem 0; color: #4c6674; }
.flight-history__details strong { color: #315b6f; }
.flight-history__details ul { margin: .35rem 0 .45rem; padding-left: 1.5rem; }
.flight-history__details li { margin: .15rem 0; }
.flight-history__status { font-size: .84em; margin: .15rem 0 0 !important; padding: 0 .95rem .75rem; color: #73848b; }
@media (max-width: 600px) { .flight-history__canvas { height: 270px; } .flight-history__bar { padding: .7rem; } .flight-history__details { padding: .7rem .7rem 0; } .flight-history__status { padding: 0 .7rem .7rem; } }
</style>

<div class="flight-history" id="flight-history-widget" data-flights-url="{{ '/assets/data/flights.csv' | relative_url }}">
  <div class="flight-history__bar">
    <label class="flight-history__control" for="flight-history-year">Year
      <select id="flight-history-year" aria-label="Filter flight routes by year" disabled>
        <option value="all">All years</option>
      </select>
    </label>
    <div class="flight-history__stats" aria-live="polite">
      <span><strong id="flight-history-count">0</strong> flights</span>
      <span><strong id="flight-history-airports">0</strong> airports</span>
      <span title="Sum of great-circle distances, not actual flown distance"><strong id="flight-history-km">0</strong> km</span>
    </div>
  </div>
  <div class="flight-history__canvas" id="flight-history-canvas">
    <svg id="flight-history-svg" role="img" aria-label="Interactive map of my flights"></svg>
    <div class="flight-history__zoom" aria-label="Map zoom controls">
      <button type="button" data-flight-action="in" aria-label="Zoom in">+</button>
      <button type="button" data-flight-action="out" aria-label="Zoom out">−</button>
      <button type="button" data-flight-action="reset" aria-label="Reset to full map">⌂</button>
    </div>
  </div>
  <div class="flight-history__details" id="flight-history-details" aria-live="polite">Click a route to see the flight dates.</div>
  <p class="flight-history__status" id="flight-history-status" role="status">Loading flight map…</p>
</div>

<script src="https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js"></script>
<script>
(function () {
  'use strict';
  const root = document.getElementById('flight-history-widget');
  if (!root) return;
  const $ = id => document.getElementById(id);
  const status = $('flight-history-status');
  const details = $('flight-history-details');
  const yearMenu = $('flight-history-year');
  const canvas = $('flight-history-canvas');
  const svg = window.d3 && d3.select('#flight-history-svg');
  if (!window.d3 || !window.topojson || !svg) {
    status.textContent = 'Map libraries could not be loaded. Please refresh the page.';
    return;
  }

  // Snapshot of a public IATA-airport database. This external CSV is read in the browser.
  // To use a different source, replace the URL and update the field names below.
  const airportsURL = 'https://cdn.jsdelivr.net/gh/tine-current/airport-codes@0555fe150a7df9905df9dc3267b2ec269491edaf/data/airports.csv';
  const worldURL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json';
  const formatter = new Intl.NumberFormat('en-US');
  let airports = new Map();
  let flights = [];
  let countries = null;
  let zoom = null;
  let invalid = 0;
  let resizeHandle;

  function coordinates(code) {
    const a = airports.get(code);
    return a ? [a.longitude, a.latitude] : null;
  }
  function parseFlight(row) {
    const date = String(row.date || '').trim();
    const from = String(row.from || '').trim().toUpperCase();
    const to = String(row.to || '').trim().toUpperCase();
    const note = String(row.note || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to) ||
        from === to || !airports.has(from) || !airports.has(to)) return null;
    const dateValue = new Date(date + 'T00:00:00Z');
    if (Number.isNaN(dateValue.valueOf()) || dateValue.toISOString().slice(0, 10) !== date) return null;
    return { date, year: date.slice(0, 4), from, to, note };
  }
  function flightDistance(f) {
    return 6371.0088 * d3.geoDistance(coordinates(f.from), coordinates(f.to));
  }
  function routesFor(selected) {
    const groups = new Map();
    selected.forEach(f => {
      const codes = [f.from, f.to].sort();
      const key = codes.join('–');
      if (!groups.has(key)) groups.set(key, { a: codes[0], b: codes[1], flights: [] });
      groups.get(key).flights.push(f);
    });
    return Array.from(groups.values()).map(route => {
      const interpolation = d3.geoInterpolate(coordinates(route.a), coordinates(route.b));
      route.line = {
        type: 'LineString',
        coordinates: d3.range(65).map(i => interpolation(i / 64))
      };
      route.flights.sort((a, b) => a.date.localeCompare(b.date));
      return route;
    });
  }
  function explain(title, matchingFlights) {
    details.replaceChildren();
    const bold = document.createElement('strong');
    bold.textContent = title;
    details.appendChild(bold);
    if (!matchingFlights.length) return;
    const list = document.createElement('ul');
    matchingFlights.slice(0, 20).forEach(f => {
      const item = document.createElement('li');
      item.textContent = f.date + ' · ' +
        f.from + ' → ' + f.to + (f.note ? ' · ' + f.note : '');
      list.appendChild(item);
    });
    details.appendChild(list);
    if (matchingFlights.length > 20) {
      details.appendChild(document.createTextNode('…and ' + (matchingFlights.length - 20) + ' more.'));
    }
  }
  function render() {
    if (!countries) return;
    const w = Math.max(280, canvas.clientWidth);
    const h = Math.max(200, canvas.clientHeight);
    const projection = d3.geoNaturalEarth1()
      .fitExtent([[12, 12], [w - 12, h - 12]], { type: 'Sphere' });
    const path = d3.geoPath(projection);
    const selected = yearMenu.value === 'all' ? flights : flights.filter(f => f.year === yearMenu.value);
    const visibleAirports = new Set();
    let distance = 0;
    selected.forEach(f => {
      visibleAirports.add(f.from);
      visibleAirports.add(f.to);
      distance += flightDistance(f);
    });
    $('flight-history-count').textContent = formatter.format(selected.length);
    $('flight-history-airports').textContent = formatter.format(visibleAirports.size);
    $('flight-history-km').textContent = formatter.format(Math.round(distance));

    const groups = routesFor(selected);
    svg.attr('viewBox', '0 0 ' + w + ' ' + h).selectAll('*').remove();
    const layer = svg.append('g');
    layer.append('path').datum({ type: 'Sphere' }).attr('class', 'flight-history__ocean').attr('d', path);
    layer.append('path').datum(d3.geoGraticule10()).attr('class', 'flight-history__grid').attr('d', path);
    layer.append('g').selectAll('path')
      .data(topojson.feature(countries, countries.objects.countries).features).join('path')
      .attr('class', 'flight-history__land').attr('d', path);

    const paths = layer.append('g').selectAll('g').data(groups).join('g')
      .attr('class', 'flight-history__leg');
    paths.append('path').attr('class', 'flight-history__curve')
      .attr('d', d => path(d.line))
      .style('stroke-width', d => Math.min(4.5, 1.7 + Math.sqrt(d.flights.length) * .55) + 'px');
    paths.append('path').attr('class', 'flight-history__hit')
      .attr('d', d => path(d.line))
      .attr('tabindex', '0').attr('role', 'button')
      .attr('aria-label', d => d.a + ' to ' + d.b + ', ' + d.flights.length + ' flight legs')
      .on('click', function (event, route) {
        event.stopPropagation();
        paths.classed('is-active', d => d === route);
        explain(route.a + ' ↔ ' + route.b + ' · ' + route.flights.length + ' flight(s)', route.flights);
      })
      .on('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          d3.select(this).dispatch('click');
        }
      })
      .append('title').text(d => d.a + ' ↔ ' + d.b + ' (' + d.flights.length + ' flights)');

    layer.append('g').selectAll('circle').data(Array.from(visibleAirports).sort()).join('circle')
      .attr('class', 'flight-history__airport')
      .attr('cx', code => projection(coordinates(code))[0])
      .attr('cy', code => projection(coordinates(code))[1])
      .attr('r', 3.7).attr('role', 'button').attr('tabindex', '0')
      .attr('aria-label', code => code + ': ' + airports.get(code).name)
      .on('click', function (event, code) {
        event.stopPropagation();
        paths.classed('is-active', false);
        explain(code + ' · ' + airports.get(code).name,
          selected.filter(f => f.from === code || f.to === code));
      })
      .on('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          d3.select(this).dispatch('click');
        }
      })
      .append('title').text(code => code + ' · ' + airports.get(code).name);

    zoom = d3.zoom().scaleExtent([1, 8]).on('zoom', event => layer.attr('transform', event.transform));
    svg.call(zoom).on('wheel.zoom', null); // Scroll the page normally; use zoom buttons.
    explain('Select a route to see the flight dates.', []);
    if (selected.length) {
      // Auto-frame the selected routes without losing the world overview context.
      const xy = groups.flatMap(group => group.line.coordinates)
        .map(coord => projection(coord)).filter(coord => coord && coord.every(Number.isFinite));
      if (xy.length) {
        const minX = d3.min(xy, d => d[0]), maxX = d3.max(xy, d => d[0]);
        const minY = d3.min(xy, d => d[1]), maxY = d3.max(xy, d => d[1]);
        const scale = Math.max(1, Math.min(5, .77 / Math.max((maxX - minX) / w, (maxY - minY) / h, .12)));
        const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
        svg.call(zoom.transform, d3.zoomIdentity.translate(w / 2 - scale * centerX, h / 2 - scale * centerY).scale(scale));
      }
    }
    if (!flights.length && invalid) {
      status.textContent = 'No valid flight rows. Check the dates and three-letter IATA airport codes in flights.csv.';
    } else if (!flights.length) {
      status.textContent = 'The map is ready. Add flight records to assets/data/flights.csv to draw routes.';
    } else {
      status.textContent = (invalid ? invalid + ' invalid row(s) ignored. ' : '') +
        'Drag to pan, use +/− to zoom, and select a route for dates. Distances are great-circle estimates.';
    }
  }

  Promise.all([d3.csv(root.dataset.flightsUrl), d3.csv(airportsURL), d3.json(worldURL)])
    .then(([flightRows, airportRows, world]) => {
      airportRows.forEach(a => {
        const code = String(a.iata || '').toUpperCase();
        const latitude = Number(a.latitude), longitude = Number(a.longitude);
        if (/^[A-Z]{3}$/.test(code) && Number.isFinite(latitude) && Number.isFinite(longitude)) {
          airports.set(code, { latitude, longitude, name: a.name || code });
        }
      });
      const seenFlights = new Set();
      flightRows.forEach(row => {
        const record = parseFlight(row);
        if (!record) { invalid += 1; return; }
        const identity = [record.date, record.from, record.to, record.note].join('|');
        if (seenFlights.has(identity)) return;  // Ignore exact duplicate rows.
        seenFlights.add(identity);
        flights.push(record);
      });
      flights.sort((a, b) => b.date.localeCompare(a.date));
      countries = world;
      Array.from(new Set(flights.map(f => f.year))).sort().reverse().forEach(year => {
        const opt = document.createElement('option');
        opt.value = year;
        opt.textContent = year;
        yearMenu.appendChild(opt);
      });
      yearMenu.disabled = flights.length === 0;
      yearMenu.addEventListener('change', render);
      root.querySelectorAll('[data-flight-action]').forEach(button => {
        button.addEventListener('click', () => {
          if (!zoom) return;
          const action = button.dataset.flightAction;
          const target = svg.transition().duration(200);
          if (action === 'in') target.call(zoom.scaleBy, 1.4);
          else if (action === 'out') target.call(zoom.scaleBy, 1 / 1.4);
          else target.call(zoom.transform, d3.zoomIdentity);
        });
      });
      if (window.ResizeObserver) new ResizeObserver(() => {
        clearTimeout(resizeHandle);
        resizeHandle = setTimeout(render, 120);
      }).observe(canvas);
      else window.addEventListener('resize', () => {
        clearTimeout(resizeHandle);
        resizeHandle = setTimeout(render, 120);
      });
      render();
    })
    .catch(error => {
      status.textContent = 'Could not load the map data. Check the connection and CSV location.';
      console.error('Flight history map:', error);
    });
})();
</script>
