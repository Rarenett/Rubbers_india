const deliveryLocations = [
    { id: 10, location_name: "St. Augustine's Church\u200b" },
    { id: 11, location_name: "Kothamangalam - Vazhakulam Road\u200b" },
    { id: 12, location_name: "Vazhakulam\u200b" },
    { id: 13, location_name: "Sabarimala - Kodaikkanal Road\u200b" }
];

const areaPolygonDistances = [
    { from_location: "Unnamed Location", to_location: "Unnamed Location", distance_km: 1.52 },
    { from_location: "Unnamed Location", to_location: "Unnamed Location", distance_km: 2.79 },
    { from_location: "Unnamed Location", to_location: "Unnamed Location", distance_km: 7.88 },
    { from_location: "Unnamed Location", to_location: "Unnamed Location", distance_km: 4.32 }
];

const formData = {
    delivery_locations: [
        { value: 10, label: "St. Augustine's Church" },
        { value: 11, label: "Kothamangalam - Vazhakulam Road" },
        { value: 12, label: "Vazhakulam" },
        { value: 13, label: "Sabarimala - Kodaikkanal Road" }
    ]
};

const uniqueSelected = [];
const seenIds = new Set();
for (const loc of formData.delivery_locations) {
    if (!seenIds.has(loc.value)) {
        seenIds.add(loc.value);
        uniqueSelected.push(loc);
    }
}

const routeOrder = areaPolygonDistances.map(d => (d.from_location || '').replace(/[\u200B]/g, '').trim());

const dlToRouteIdx = {};
let rIdx = 0;
let allMapped = true;
for (let i = 0; i < deliveryLocations.length; i++) {
    const dlName = (deliveryLocations[i].location_name || '').replace(/[\u200B]/g, '').trim();
    let found = false;
    for (let j = 0; j < routeOrder.length; j++) {
        const testIdx = (rIdx + j) % routeOrder.length;
        if (routeOrder[testIdx] === dlName) {
            dlToRouteIdx[i] = testIdx;
            rIdx = testIdx + 1;
            found = true;
            break;
        }
    }
    if (!found) {
        dlToRouteIdx[i] = -1;
        allMapped = false;
    }
}

if (!allMapped) {
    for (let i = 0; i < deliveryLocations.length; i++) {
        dlToRouteIdx[i] = i;
    }
}

const selectedLocs = uniqueSelected.map(loc => {
    const dlIdx = deliveryLocations.findIndex(d => d.id === loc.value);
    return { idx: dlIdx !== -1 ? dlIdx : 9999 };
});

selectedLocs.sort((a, b) => a.idx - b.idx);

const allSelected = uniqueSelected.length === deliveryLocations.length;
const iterations = allSelected ? selectedLocs.length : selectedLocs.length - 1;

let cumulativeDist = 0;
let pathFound = true;

for (let i = 0; i < iterations; i++) {
    const startIdx = selectedLocs[i].idx;
    const endIdx = selectedLocs[(i + 1) % selectedLocs.length].idx;
    
    if (startIdx === 9999 || endIdx === 9999) {
        pathFound = false; break;
    }
    
    const startRIdx = dlToRouteIdx[startIdx];
    const endRIdx = dlToRouteIdx[endIdx];
    
    if (startRIdx === undefined || endRIdx === undefined || startRIdx === -1 || endRIdx === -1) {
        pathFound = false; break;
    }
    
    let currRIdx = startRIdx;
    while (currRIdx !== endRIdx) {
        const pSeg = areaPolygonDistances[currRIdx];
        if (pSeg && pSeg.distance_km !== undefined) {
            cumulativeDist += parseFloat(pSeg.distance_km);
        } else {
            pathFound = false; break;
        }
        currRIdx = (currRIdx + 1) % areaPolygonDistances.length;
        
        if (currRIdx === startRIdx) {
            pathFound = false; break;
        }
    }
    if (!pathFound) break;
}

if (pathFound && cumulativeDist >= 0) {
    console.log(`${cumulativeDist.toFixed(2)} Km`);
} else {
    console.log('BLANK');
}
