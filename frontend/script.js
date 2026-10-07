const API_URL = ""; // change if your FastAPI runs elsewhere

// Order matches model.classes_ (probabilities come back in this order)
const CLASSES = [
  { name: "Entire home/apt", letter: "B", color: "#ff6319" },
  { name: "Private room",    letter: "P", color: "#00b050" },
  { name: "Shared room",     letter: "S", color: "#2d6bff" },
];

const BOROUGHS = {
  "Bronx":         [40.8448, -73.8648],
  "Brooklyn":      [40.6782, -73.9442],
  "Manhattan":     [40.7831, -73.9712],
  "Queens":        [40.7282, -73.7949],
  "Staten Island": [40.5795, -74.1502],
};

const HOODS = "Allerton|Arden Heights|Arrochar|Arverne|Astoria|Bath Beach|Battery Park City|Bay Ridge|Bay Terrace|Bay Terrace, Staten Island|Baychester|Bayside|Bayswater|Bedford-Stuyvesant|Belle Harbor|Bellerose|Belmont|Bensonhurst|Bergen Beach|Boerum Hill|Borough Park|Breezy Point|Briarwood|Brighton Beach|Bronxdale|Brooklyn Heights|Brownsville|Bull's Head|Bushwick|Cambria Heights|Canarsie|Carroll Gardens|Castle Hill|Castleton Corners|Chelsea|Chinatown|City Island|Civic Center|Claremont Village|Clason Point|Clifton|Clinton Hill|Co-op City|Cobble Hill|College Point|Columbia St|Concord|Concourse|Concourse Village|Coney Island|Corona|Crown Heights|Cypress Hills|DUMBO|Ditmars Steinway|Dongan Hills|Douglaston|Downtown Brooklyn|Dyker Heights|East Elmhurst|East Flatbush|East Harlem|East Morrisania|East New York|East Village|Eastchester|Edenwald|Edgemere|Elmhurst|Eltingville|Emerson Hill|Far Rockaway|Fieldston|Financial District|Flatbush|Flatiron District|Flatlands|Flushing|Fordham|Forest Hills|Fort Greene|Fort Hamilton|Fresh Meadows|Glendale|Gowanus|Gramercy|Graniteville|Grant City|Gravesend|Great Kills|Greenpoint|Greenwich Village|Grymes Hill|Harlem|Hell's Kitchen|Highbridge|Hollis|Holliswood|Howard Beach|Howland Hook|Huguenot|Hunts Point|Inwood|Jackson Heights|Jamaica|Jamaica Estates|Jamaica Hills|Kensington|Kew Gardens|Kew Gardens Hills|Kingsbridge|Kips Bay|Laurelton|Little Italy|Little Neck|Long Island City|Longwood|Lower East Side|Manhattan Beach|Marble Hill|Mariners Harbor|Maspeth|Melrose|Middle Village|Midland Beach|Midtown|Midwood|Mill Basin|Morningside Heights|Morris Heights|Morris Park|Morrisania|Mott Haven|Mount Eden|Mount Hope|Murray Hill|Navy Yard|Neponsit|New Brighton|New Dorp|New Dorp Beach|New Springville|NoHo|Nolita|North Riverdale|Norwood|Oakwood|Olinville|Ozone Park|Park Slope|Parkchester|Pelham Bay|Pelham Gardens|Port Morris|Port Richmond|Prince's Bay|Prospect Heights|Prospect-Lefferts Gardens|Queens Village|Randall Manor|Red Hook|Rego Park|Richmond Hill|Ridgewood|Riverdale|Rockaway Beach|Roosevelt Island|Rosebank|Rosedale|Rossville|Schuylerville|Sea Gate|Sheepshead Bay|Shore Acres|Silver Lake|SoHo|Soundview|South Beach|South Ozone Park|South Slope|Springfield Gardens|Spuyten Duyvil|St. Albans|St. George|Stapleton|Stuyvesant Town|Sunnyside|Sunset Park|Theater District|Throgs Neck|Todt Hill|Tompkinsville|Tottenville|Tremont|Tribeca|Two Bridges|Unionport|University Heights|Upper East Side|Upper West Side|Van Nest|Vinegar Hill|Wakefield|Washington Heights|West Brighton|West Farms|West Village|Westchester Square|Westerleigh|Whitestone|Williamsbridge|Williamsburg|Willowbrook|Windsor Terrace|Woodhaven|Woodlawn|Woodside".split("|");

const PRESETS = {
  midtown:  { borough: "Manhattan", neighbourhood: "Midtown", latitude: 40.7549, longitude: -73.984, price: 220, minimum_nights: 2, availability_365: 280, number_of_reviews: 45, reviews_per_month: 1.8, calculated_host_listings_count: 3 },
  brooklyn: { borough: "Brooklyn",  neighbourhood: "Bedford-Stuyvesant", latitude: 40.6872, longitude: -73.9418, price: 65, minimum_nights: 1, availability_365: 120, number_of_reviews: 30, reviews_per_month: 1.1, calculated_host_listings_count: 1 },
  queens:   { borough: "Queens",    neighbourhood: "Jamaica", latitude: 40.7027, longitude: -73.7890, price: 35, minimum_nights: 1, availability_365: 330, number_of_reviews: 8, reviews_per_month: 0.5, calculated_host_listings_count: 4 },
};

const $ = (id) => document.getElementById(id);
const form = $("form");
const FIELDS = ["latitude","longitude","price","minimum_nights","number_of_reviews","reviews_per_month","calculated_host_listings_count","availability_365","neighbourhood"];

/* ---------- setup ---------- */
$("hoods").innerHTML = HOODS.map((h) => `<option value="${h.replace(/"/g, "&quot;")}">`).join("");
$("boroughs").innerHTML = Object.keys(BOROUGHS).map((b, i) =>
  `<label><input type="radio" name="neighbourhood_group" value="${b}" ${i === 2 ? "checked" : ""}>${b}</label>`).join("");

const getBorough = () => form.neighbourhood_group.value;
const setBorough = (b) => { const r = form.querySelector(`input[name=neighbourhood_group][value="${b}"]`); if (r) r.checked = true; };

/* ---------- map ---------- */
const map = $("map"), mctx = map.getContext("2d");
const BOX = { latMin: 40.48, latMax: 40.93, lonMin: -74.28, lonMax: -73.68 };
const toXY = (lat, lon) => [(lon - BOX.lonMin) / (BOX.lonMax - BOX.lonMin) * map.width, (BOX.latMax - lat) / (BOX.latMax - BOX.latMin) * map.height];
const toLL = (x, y) => [BOX.latMax - y / map.height * (BOX.latMax - BOX.latMin), BOX.lonMin + x / map.width * (BOX.lonMax - BOX.lonMin)];

let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const lights = [];
Object.values(BOROUGHS).forEach(([la, lo]) => {
  for (let i = 0; i < 90; i++) {
    const a = rnd() * 6.28, r = Math.pow(rnd(), 1.4) * 0.07;
    lights.push([la + Math.sin(a) * r * 0.75, lo + Math.cos(a) * r, rnd()]);
  }
});

let pin = null, pulse = 0;
function drawMap(t = 0) {
  const { width: W, height: H } = map;
  mctx.clearRect(0, 0, W, H);
  mctx.strokeStyle = "#1a2236"; mctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { mctx.beginPath(); mctx.moveTo(x, 0); mctx.lineTo(x, H); mctx.stroke(); }
  for (let y = 0; y < H; y += 40) { mctx.beginPath(); mctx.moveTo(0, y); mctx.lineTo(W, y); mctx.stroke(); }
  lights.forEach(([la, lo, p]) => {
    const [x, y] = toXY(la, lo);
    mctx.fillStyle = `rgba(255,199,44,${0.25 + 0.5 * Math.abs(Math.sin(t / 900 + p * 9))})`;
    mctx.fillRect(x, y, 2, 2);
  });
  mctx.font = "600 13px 'Instrument Sans',sans-serif"; mctx.textAlign = "center";
  Object.entries(BOROUGHS).forEach(([n, [la, lo]]) => {
    const [x, y] = toXY(la, lo);
    mctx.fillStyle = n === getBorough() ? "#ffc72c" : "#6c7694";
    mctx.fillText(n, x, y + 56);
  });
  if (pin) {
    const [x, y] = toXY(...pin);
    const p = (t % 1600) / 1600;
    mctx.strokeStyle = `rgba(255,199,44,${1 - p})`; mctx.lineWidth = 2;
    mctx.beginPath(); mctx.arc(x, y, 8 + p * 30, 0, 6.28); mctx.stroke();
    mctx.fillStyle = "#ffc72c"; mctx.beginPath(); mctx.arc(x, y, 7, 0, 6.28); mctx.fill();
    mctx.strokeStyle = "#080b12"; mctx.lineWidth = 3; mctx.stroke();
  }
  requestAnimationFrame(drawMap);
}

function nearestBorough(lat, lon) {
  return Object.entries(BOROUGHS).sort((a, b) =>
    Math.hypot(a[1][0] - lat, a[1][1] - lon) - Math.hypot(b[1][0] - lat, b[1][1] - lon))[0][0];
}
function syncPin() {
  const la = parseFloat(form.latitude.value), lo = parseFloat(form.longitude.value);
  pin = isNaN(la) || isNaN(lo) ? null : [la, lo];
}
map.addEventListener("click", (e) => {
  const r = map.getBoundingClientRect();
  const [la, lo] = toLL((e.clientX - r.left) * map.width / r.width, (e.clientY - r.top) * map.height / r.height);
  form.latitude.value = la.toFixed(5); form.longitude.value = lo.toFixed(5);
  setBorough(nearestBorough(la, lo)); syncPin();
});
["latitude", "longitude"].forEach((f) => form[f].addEventListener("input", syncPin));
form.addEventListener("change", (e) => {
  if (e.target.name === "neighbourhood_group") {
    const [la, lo] = BOROUGHS[getBorough()];
    form.latitude.value = la; form.longitude.value = lo; syncPin();
  }
});

/* ---------- slider + presets ---------- */
form.availability_365.addEventListener("input", (e) => ($("availOut").textContent = e.target.value));

document.querySelectorAll("[data-preset]").forEach((btn) => btn.addEventListener("click", () => {
  const p = PRESETS[btn.dataset.preset];
  setBorough(p.borough);
  FIELDS.forEach((f) => (form[f].value = p[f]));
  $("availOut").textContent = p.availability_365;
  syncPin(); clearErrors();
}));

/* ---------- API status ---------- */
fetch(API_URL + "/").then((r) => r.ok ? setStatus(true) : setStatus(false)).catch(() => setStatus(false));
function setStatus(ok) {
  const s = $("status");
  s.className = "status " + (ok ? "ok" : "bad");
  s.lastElementChild.textContent = ok ? "API connected" : "API not reachable. Start it with: uvicorn main:app --reload";
}

/* ---------- submit ---------- */
function clearErrors() { $("error").textContent = ""; form.querySelectorAll(".bad").forEach((i) => i.classList.remove("bad")); }

form.addEventListener("submit", async (e) => {
  e.preventDefault(); clearErrors();
  const bad = FIELDS.filter((f) => !form[f].checkValidity() || form[f].value.trim() === "");
  if (bad.length) {
    bad.forEach((f) => form[f].classList.add("bad"));
    $("error").textContent = "Please fix the highlighted fields.";
    form[bad[0]].focus(); return;
  }
  const payload = {
    latitude: +form.latitude.value, longitude: +form.longitude.value, price: +form.price.value,
    minimum_nights: parseInt(form.minimum_nights.value), number_of_reviews: parseInt(form.number_of_reviews.value),
    reviews_per_month: +form.reviews_per_month.value,
    calculated_host_listings_count: parseInt(form.calculated_host_listings_count.value),
    availability_365: parseInt(form.availability_365.value),
    neighbourhood_group: getBorough(), neighbourhood: form.neighbourhood.value.trim(),
  };
  const btn = $("go"); btn.classList.add("loading");
  try {
    const res = await fetch(API_URL + "/predict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const d = Array.isArray(err.detail) ? err.detail.map((x) => `${x.loc.slice(-1)}: ${x.msg}`).join(" · ") : "Server error";
      throw new Error(d);
    }
    showResult(await res.json());
  } catch (err) {
    $("error").textContent = err.message === "Failed to fetch" ? "Can't reach the API. Is FastAPI running at " + API_URL + "?" : err.message;
  } finally { btn.classList.remove("loading"); }
});

/* ---------- result ---------- */
function showResult(data) {
  const probs = data.Probability;
  const topIdx = probs.indexOf(Math.max(...probs));
  const top = CLASSES.find((c) => c.name === data.Predicted_room_type) || CLASSES[topIdx];

  $("empty").hidden = true;
  const filled = $("filled"); filled.hidden = false;
  filled.classList.remove("show"); void filled.offsetWidth; filled.classList.add("show");

  $("bullet").textContent = top.letter; $("bullet").style.setProperty("--c", top.color);
  $("verdict").textContent = top.name;
  countUp($("conf"), probs[topIdx] * 100, (v) => `${v.toFixed(1)}% confident`);

  $("bars").innerHTML = CLASSES.map((c, i) => `
    <li class="${i === topIdx ? "top" : ""}" style="--c:${c.color}">
      <span>${c.name}</span><b data-p="${probs[i] * 100}">0%</b>
      <div class="track"><div class="fill"></div></div>
    </li>`).join("");
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelectorAll("#bars li").forEach((li) => {
      const v = +li.querySelector("b").dataset.p;
      li.querySelector(".fill").style.width = v + "%";
      countUp(li.querySelector("b"), v, (n) => n.toFixed(1) + "%");
    });
  }));
  $("result").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function countUp(el, to, fmt, ms = 1000) {
  const start = performance.now();
  (function step(now) {
    const k = Math.min((now - start) / ms, 1), eased = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(to * eased);
    if (k < 1) requestAnimationFrame(step);
  })(start);
}

/* ---------- ambient background ---------- */
const bg = $("bg"), bctx = bg.getContext("2d");
let dots = [];
function resizeBg() {
  bg.width = innerWidth; bg.height = innerHeight;
  dots = Array.from({ length: Math.min(70, Math.floor(innerWidth / 18)) }, () => ({
    x: Math.random() * bg.width, y: Math.random() * bg.height, v: 0.1 + Math.random() * 0.25, r: 0.8 + Math.random() * 1.6,
  }));
}
addEventListener("resize", resizeBg); resizeBg();
(function bgLoop() {
  bctx.clearRect(0, 0, bg.width, bg.height);
  dots.forEach((d) => {
    d.y -= d.v; if (d.y < -4) { d.y = bg.height + 4; d.x = Math.random() * bg.width; }
    bctx.fillStyle = "rgba(255,199,44,.35)"; bctx.beginPath(); bctx.arc(d.x, d.y, d.r, 0, 6.28); bctx.fill();
  });
  requestAnimationFrame(bgLoop);
})();

/* ---------- start ---------- */
form.latitude.value = BOROUGHS.Manhattan[0]; form.longitude.value = BOROUGHS.Manhattan[1];
syncPin(); requestAnimationFrame(drawMap);
