import test from "node:test";
import assert from "node:assert/strict";

import { buildActionPlan, buildDispatchBoard, buildLocationRiskSummary, buildOperationalBrief, defaultFilters } from "./dataProcessing";

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

test("buildOperationalBrief creates a concise action summary for top hotspots", () => {
  const result = buildLocationRiskSummary(sampleRecords, defaultFilters);
  const brief = buildOperationalBrief(result.locationSummaries);

  assert.ok(brief.headline.toLowerCase().includes("priority") || brief.keyTakeaways.length > 0);
  assert.ok(brief.recommendedActions.length >= 1);
  assert.match(brief.recommendedActions[0].toLowerCase(), /atlantic|priority|intervention|review/i);
});

test("buildActionPlan creates concrete field actions for the top locations", () => {
  const result = buildLocationRiskSummary(sampleRecords, defaultFilters);
  const plan = buildActionPlan(result.locationSummaries);

  assert.ok(plan.headline.toLowerCase().includes("field") || plan.headline.toLowerCase().includes("response"));
  assert.ok(plan.actions.length >= 1);
  assert.ok(plan.actions[0].task.length > 0);
  assert.ok(plan.actions[0].urgency === "Immediate" || plan.actions[0].urgency === "Near-term" || plan.actions[0].urgency === "Monitor");
});

test("buildDispatchBoard creates a field dispatch list for team planning", () => {
  const result = buildLocationRiskSummary(sampleRecords, defaultFilters);
  const board = buildDispatchBoard(result.locationSummaries); 

  assert.ok(board.headline.toLowerCase().includes("dispatch") || board.headline.toLowerCase().includes("team"));
  assert.ok(board.assignments.length >= 1);
  assert.ok(board.assignments[0].crew.length > 0);
  assert.ok(board.assignments[0].window.length > 0);
});
