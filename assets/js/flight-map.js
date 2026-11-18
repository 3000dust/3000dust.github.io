/* Interactive personal flight map for Jekyll. No map API key required. */
(function () {
  "use strict";

  var root = document.getElementById("flight-map");
  if (!root) return;

  var status = document.getElementById("flight-map-status");
  var details = document.getElementById("flight-map-details");
  var yearSelect = document.getElementById("flight-map-year");
  var canvas = document.getElementById("flight-map-canvas");
  var svgElement = document.getElementById("flight-map-svg");
  var flightCount = document.getElementById("flight-map-count");
  var airportCount = document.getElementById("flight-map-airports");
  var distanceCount = document.getElementById("flight-map-distance");
  var jsonElement = document.getElementById("flight-map-data");
  var fmt = new Intl.NumberFormat("en-US");

  if (!window.d3 || !window.topojson) {
    status.textContent = "The map library could not load. Please refresh the page.";
    return;
  }

  var d3 = window.d3;
  var flightsFromCsv;
  try {
    flightsFromCsv = JSON.parse((jsonElement && jsonElement.textContent) || "[]");
    if (!Array.isArray(flightsFromCsv)) throw new Error("Not an array");
  } catch (error) {
    status.textContent = "Flight records could not be read.";
    return;
  }

  var atlasUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";
  var airports = {};
  var atlas = null;
  var flights = [];
  var invalid = 0;
  var currentZoom = null;
  var svg = d3.select(svgElement);
  var rerenderTimer = null;

  function parseFlight(record) {
    var date = String(record.date || "").trim();
    var from = String(record.from || "").trim().toUpperCase();
    var to = String(record.to || "").trim().toUpperCase();
    var note = String(record.note || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^[A-Z]{3}$/.test(from) ||
        !/^[A-Z]{3}$/.test(to) || from === to || !airports[from] || !airports[to]) return null;
    var parsedDate = new Date(date + "T00:00:00Z");
    if (isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) return null;
    return {date: date, year: date.slice(0, 4), from: from, to: to, note: note};
  }

  function point(code) {
    return [airports[code][1], airports[code][0]]; // D3 uses [longitude, latitude].
  }

  function greatCircle(a, b) {
    var interpolate = d3.geoInterpolate(point(a), point(b));
    var coords = [];
    for (var i = 0; i <= 64; i += 1) coords.push(interpolate(i / 64));
    return {type: "LineString", coordinates: coords};
  }

  function showDetail(title, items) {
    details.replaceChildren();
    var heading = document.createElement("strong");
    heading.textContent = title;
    details.appendChild(heading);
    if (!items || !items.length) return;
    var list = document.createElement("ul");
    items.slice(0, 15).forEach(function (f) {
      var li = document.createElement("li");
      li.textContent = f.date + " · " + f.from + " → " + f.to + (f.note ? " · " + f.note : "");
      list.appendChild(li);
    });
    details.appendChild(list);
    if (items.length > 15) {
      var more = document.createElement("span");
      more.textContent = "…and " + (items.length - 15) + " more.";
      details.appendChild(more);
    }
  }

  function selectedFlights() {
    return yearSelect.value === "all" ? flights : flights.filter(function (f) {
      return f.year === yearSelect.value;
    });
  }

  function updateStats(visible) {
    var unique = new Set();
    var km = 0;
    visible.forEach(function (f) {
      unique.add(f.from);
      unique.add(f.to);
      km += d3.geoDistance(point(f.from), point(f.to)) * 6371.0088;
    });
    flightCount.textContent = fmt.format(visible.length);
    airportCount.textContent = fmt.format(unique.size);
    distanceCount.textContent = fmt.format(Math.round(km));
    return unique;
  }

  function routeGroups(visible) {
    var groups = new Map();
    visible.forEach(function (f) {
      var codes = [f.from, f.to].sort();
      var key = codes.join("-");
      if (!groups.has(key)) groups.set(key, {a: codes[0], b: codes[1], legs: []});
      groups.get(key).legs.push(f);
    });
    return Array.from(groups.values()).map(function (group) {
      group.legs.sort(function (a, b) { return a.date.localeCompare(b.date); });
      group.line = greatCircle(group.a, group.b);
      return group;
    });
  }

  function buildMap() {
    if (!atlas) return;
    var width = Math.max(280, canvas.clientWidth);
    var height = Math.max(220, canvas.clientHeight);
    var projection = d3.geoNaturalEarth1().fitExtent([[12, 12], [width - 12, height - 12]], {type: "Sphere"});
    var path = d3.geoPath(projection);
    var visible = selectedFlights();
    var codes = updateStats(visible);
    var groups = routeGroups(visible);

    svg.attr("viewBox", "0 0 " + width + " " + height);
    svg.selectAll("*").remove();
    var world = svg.append("g");

    world.append("path")
      .datum({type: "Sphere"})
      .attr("class", "flight-map__ocean")
      .attr("d", path);

    world.append("path")
      .datum(d3.geoGraticule10())
      .attr("class", "flight-map__graticule")
      .attr("d", path);

    world.append("g").selectAll("path")
      .data(window.topojson.feature(atlas, atlas.objects.countries).features)
      .join("path")
      .attr("class", "flight-map__country")
      .attr("d", path);

    var routes = world.append("g").selectAll("g")
      .data(groups)
      .join("g")
      .attr("class", "flight-map__route");

    routes.append("path")
      .attr("class", "flight-map__arc")
      .attr("d", function (g) { return path(g.line); })
      .style("stroke-width", function (g) { return Math.min(4.5, 1.8 + Math.sqrt(g.legs.length) * .5) + "px"; });

    routes.append("path")
      .attr("class", "flight-map__arc-hit")
      .attr("d", function (g) { return path(g.line); })
      .attr("tabindex", "0")
      .attr("role", "button")
      .attr("aria-label", function (g) { return g.a + " and " + g.b + ": " + g.legs.length + " flight legs. Show details."; })
      .on("click", function (event, g) {
        event.stopPropagation();
        routes.classed("is-selected", function (other) { return other === g; });
        showDetail(g.a + " ↔ " + g.b + " · " + g.legs.length + (g.legs.length === 1 ? " flight" : " flights"), g.legs);
      })
      .on("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          d3.select(this).dispatch("click");
        }
      })
      .append("title")
      .text(function (g) { return g.a + " ↔ " + g.b + " (" + g.legs.length + " flights)"; });

    world.append("g").selectAll("circle")
      .data(Array.from(codes).sort())
      .join("circle")
      .attr("class", "flight-map__airport")
      .attr("cx", function (code) { return projection(point(code))[0]; })
      .attr("cy", function (code) { return projection(point(code))[1]; })
      .attr("r", 3.7)
      .attr("tabindex", "0")
      .attr("role", "button")
      .attr("aria-label", function (code) { return code + ": " + airports[code][2]; })
      .on("click", function (event, code) {
        event.stopPropagation();
        routes.classed("is-selected", false);
        var records = visible.filter(function (f) { return f.from === code || f.to === code; });
        showDetail(code + " · " + airports[code][2], records);
      })
      .on("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          d3.select(this).dispatch("click");
        }
      })
      .append("title")
      .text(function (code) { return code + " · " + airports[code][2]; });

    currentZoom = d3.zoom().scaleExtent([1, 7])
      .on("zoom", function (event) { world.attr("transform", event.transform); });
    svg.call(currentZoom).on("wheel.zoom", null); // Keep normal page scrolling easy.

    if (visible.length) {
      var positions = [];
      groups.forEach(function (g) {
        g.line.coordinates.forEach(function (coordinate) {
          var pixel = projection(coordinate);
          if (pixel && isFinite(pixel[0]) && isFinite(pixel[1])) positions.push(pixel);
        });
      });
      if (positions.length) {
        var xs = positions.map(function (p) { return p[0]; });
        var ys = positions.map(function (p) { return p[1]; });
        var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
        var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
        var dx = Math.max(45, maxX - minX), dy = Math.max(35, maxY - minY);
        var scale = Math.max(1, Math.min(5, .78 / Math.max(dx / width, dy / height)));
        var x = (minX + maxX) / 2, y = (minY + maxY) / 2;
        svg.call(currentZoom.transform, d3.zoomIdentity.translate(width / 2 - x * scale, height / 2 - y * scale).scale(scale));
      }
    }

    showDetail("Select a route to see flight dates.", []);
    if (!flights.length) {
      status.textContent = "No flights added yet. Routes will appear once flight records are added.";
    } else if (invalid) {
      status.textContent = invalid + " record(s) could not be plotted; check dates and airport codes. Curves show great-circle paths.";
    } else {
      status.textContent = "Drag to pan, use +/− to zoom, and click a route for dates. Distances are great-circle estimates.";
    }
  }

  function loadJson(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error("Could not load " + url);
      return response.json();
    });
  }

  Promise.all([loadJson(root.dataset.airportsUrl), loadJson(atlasUrl)])
    .then(function (result) {
      airports = result[0];
      atlas = result[1];
      flightsFromCsv.forEach(function (record) {
        var flight = parseFlight(record);
        if (flight) flights.push(flight);
        else invalid += 1;
      });
      flights.sort(function (a, b) { return b.date.localeCompare(a.date); });
      var years = Array.from(new Set(flights.map(function (f) { return f.year; }))).sort().reverse();
      years.forEach(function (year) {
        var option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
      });
      yearSelect.disabled = !years.length;
      yearSelect.addEventListener("change", buildMap);

      root.querySelectorAll("[data-flight-zoom]").forEach(function (button) {
        button.addEventListener("click", function () {
          if (!currentZoom) return;
          var action = button.dataset.flightZoom;
          var svgSelection = svg.transition().duration(220);
          if (action === "in") svgSelection.call(currentZoom.scaleBy, 1.4);
          else if (action === "out") svgSelection.call(currentZoom.scaleBy, 1 / 1.4);
          else svgSelection.call(currentZoom.transform, d3.zoomIdentity);
        });
      });

      window.addEventListener("resize", function () {
        window.clearTimeout(rerenderTimer);
        rerenderTimer = window.setTimeout(buildMap, 130);
      });
      buildMap();
    })
    .catch(function (error) {
      status.textContent = "The map could not load. Check your connection and try again.";
      if (window.console) console.error("Flight map error:", error);
    });
})();
