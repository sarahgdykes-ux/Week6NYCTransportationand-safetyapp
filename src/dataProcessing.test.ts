import test from "node:test";
import assert from "node:assert/strict";

import { buildLocationRiskSummary, defaultFilters } from "./dataProcessing";

const sampleRecords = [
  {
    collisionId: "1",
    crashDate: "2024-03-12",
    crashTime: "08:15:00",
    borough: "BROOKLYN",
    latitude: 40.678,
    longitude: -73.944,
    locationLabel: "Atlantic Ave & Flatbush Ave",
    numberOfPersonsInjured: 3,
    numberOfPersonsKilled: 1,
    contributingFactors: ["Driver Inattention/Distraction", "Failure to Yield", "Pedestrian/Bicyclist Violation"],
  },
  {
    collisionId: "2",
    crashDate: "2024-05-06",
    crashTime: "17:40:00",
    borough: "BROOKLYN",
    latitude: 40.678,
    longitude: -73.944,
    locationLabel: "Atlantic Ave & Flatbush Ave",
    numberOfPersonsInjured: 2,
    numberOfPersonsKilled: 0,
    contributingFactors: ["Failure to Yield", "Driver Inattention/Distraction"],
  },
  {
    collisionId: "3",
    crashDate: "2024-08-11",
    crashTime: "22:00:00",
    borough: "BROOKLYN",
    latitude: 40.677,
    longitude: -73.943,
    locationLabel: "Atlantic Ave & Flatbush Ave",
    numberOfPersonsInjured: 1,
    numberOfPersonsKilled: 0,
    contributingFactors: ["Following Too Closely"],
  },
];

test("buildLocationRiskSummary identifies intervention drivers for a hotspot", () => {
  const result = buildLocationRiskSummary(sampleRecords, defaultFilters);
  const location = result.locationSummaries[0];

  assert.ok(location);
  assert.ok(location.riskDrivers.length >= 2);
  assert.match(location.recommendedIntervention.toLowerCase(), /signal|crossing|speed|enforcement|pedestrian|driver/i);
});
