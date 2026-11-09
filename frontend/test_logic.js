const areas = [{
  id: "9",
  name: "Angamaly",
  delivery_locations: [
    { location_name: "kalady" },
    { location_name: "Aluva" },
    { location_name: "Karukutty" },
    { location_name: "Angamaly" },
    { location_name: "Mookannoor" },
    { location_name: "Perumbavoor" }
  ]
}];

const routeStops = [
  { id: "1", stop_name: "kalady" },
  { id: "5", stop_name: "perumbavoor" }
];

const selectedArea = "9";
const mappings = []; // Assume no mappings saved yet

const areaMappings = mappings.filter(m => String(m.area) === String(selectedArea));
const mappedStops = areaMappings.filter(loc => loc.route_stop).map(loc => {
    const routeStopMatch = routeStops.find(s => String(s.id) === String(loc.route_stop));
    return routeStopMatch 
        ? { value: routeStopMatch.id, label: routeStopMatch.stop_name } 
        : { value: loc.route_stop, label: loc.route_stop_name };
});
const customNames = areaMappings.filter(loc => !loc.route_stop && loc.custom_location_name).map(loc => loc.custom_location_name);

const areaObj = areas.find(a => String(a.id) === String(selectedArea));
const autoFilledStops = [];
const unmatchedNames = [];

if (areaObj && areaObj.delivery_locations) {
    areaObj.delivery_locations.forEach(dl => {
        const dlName = dl.location_name.toLowerCase().trim();
        const matchedStop = routeStops.find(rs => rs.stop_name.toLowerCase().trim() === dlName);
        
        if (matchedStop) {
            if (!mappedStops.find(ms => String(ms.value) === String(matchedStop.id))) {
                autoFilledStops.push({ value: matchedStop.id, label: matchedStop.stop_name });
            }
        } else {
            if (!customNames.find(name => name.toLowerCase().trim() === dlName)) {
                unmatchedNames.push(dl.location_name);
            }
        }
    });
}

const combinedManual = [...customNames, ...unmatchedNames].filter(Boolean);

console.log("mappedStops:", mappedStops);
console.log("autoFilledStops:", autoFilledStops);
console.log("selectedRouteStops:", [...mappedStops, ...autoFilledStops]);
console.log("unmatchedNames:", unmatchedNames);
console.log("manualLocations:", combinedManual.join(', '));
