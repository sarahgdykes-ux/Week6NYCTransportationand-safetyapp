import { parseISO, isValid } from "date-fns";
import type { CollisionRecord, FetchParams } from "./dataApi";

export type RiskSummaryFilters = {
  startDate: string;
  endDate: string;
  borough: string | "";
  severity: "all" | "injuries" | "fatalities";
};

export const defaultFilters: RiskSummaryFilters = {
  startDate: "2024-01-01",
  endDate: "2024-12-31",
  borough: "",
  severity: "all",
};

export type LocationRiskSummary = {
  locationKey: string;
  locationLabel: string;
  borough: string;
  coordinates: { latitude: number; longitude: number };
  totalCrashes: number;
  totalInjuries: number;
  totalFatalities: number;
  severityScore: number;
  frequencyScore: number;
  prioritizationScore: number;
  priorityCategory: "high" | "medium" | "lower";
  urgencyLabel: "Immediate" | "Near-term" | "Monitor";
  topContributingFactors: string[];
  riskDrivers: string[];
  datePatterns: string[];
  investigationSignals: string[];
  riskNarrative: string;
  actionRecommendation: string;
  recommendedIntervention: string;
  peerComparison: string;
  boroughAverageCrashes: number;
  corridorContext: string;
  rank: number;
};

export type CleanupResult = {
  validRecords: number;
  invalidCount: number;
};

const PRIORITY_SCORE_WEIGHTS = {
  frequency: 0.5,
  injuries: 0.3,
  fatalities: 0.2,
};

const CATEGORY_THRESHOLDS = {
  high: 70,
  medium: 40,
};

export function buildLocationRiskSummary(
  records: CollisionRecord[],
  filters: RiskSummaryFilters
) {
  const cleaned = records
    .filter((record) => {
      const crashDate = parseISO(record.crashDate);
      if (!isValid(crashDate)) {
        return false;
      }

      const start = parseISO(filters.startDate);
      const end = parseISO(filters.endDate);
      if (isValid(start) && crashDate < start) return false;
      if (isValid(end) && crashDate > end) return false;

      if (filters.borough && record.borough !== filters.borough) return false;
      if (filters.severity === "injuries" && record.numberOfPersonsInjured === 0) return false;
      if (filters.severity === "fatalities" && record.numberOfPersonsKilled === 0) return false;
      return true;
    })
    .filter((record) => record.locationLabel && !Number.isNaN(record.latitude) && !Number.isNaN(record.longitude));

  const grouped = new Map<string, LocationRiskSummary>();

  for (const record of cleaned) {
    const locationKey = `${record.locationLabel}::${record.borough}`;
    const existing = grouped.get(locationKey);
    const contributingFactors = [...record.contributingFactors];

    if (!existing) {
      grouped.set(locationKey, {
        locationKey,
        locationLabel: record.locationLabel,
        borough: record.borough ?? "Unknown",
        coordinates: { latitude: record.latitude, longitude: record.longitude },
        totalCrashes: 1,
        totalInjuries: record.numberOfPersonsInjured,
        totalFatalities: record.numberOfPersonsKilled,
        severityScore: record.numberOfPersonsKilled * 10 + record.numberOfPersonsInjured * 2,
        frequencyScore: 1,
        prioritizationScore: 0,
        priorityCategory: "lower",
        urgencyLabel: "Monitor",
        topContributingFactors: contributingFactors,
        riskDrivers: [],
        datePatterns: [record.crashDate],
        investigationSignals: [],
        riskNarrative: "",
        actionRecommendation: "Monitor pattern and review nearby crash history.",
        recommendedIntervention: "Continue monitoring and compare with nearby corridors before a major intervention.",
        peerComparison: "",
        boroughAverageCrashes: 0,
        corridorContext: "",
        rank: 0,
      });
    } else {
      existing.totalCrashes += 1;
      existing.totalInjuries += record.numberOfPersonsInjured;
      existing.totalFatalities += record.numberOfPersonsKilled;
      existing.severityScore += record.numberOfPersonsKilled * 10 + record.numberOfPersonsInjured * 2;
      existing.frequencyScore += 1;
      existing.topContributingFactors.push(...contributingFactors);
      existing.datePatterns.push(record.crashDate);
    }
  }

  const summaries = Array.from(grouped.values());
  const maxCrashes = Math.max(...summaries.map((item) => item.totalCrashes), 1);
  const maxSeverity = Math.max(...summaries.map((item) => item.severityScore), 1);

  const boroughGroups = new Map<string, LocationRiskSummary[]>();
  for (const summary of summaries) {
    const key = summary.borough;
    const list = boroughGroups.get(key) ?? [];
    list.push(summary);
    boroughGroups.set(key, list);
  }

  const corridorGroups = new Map<string, number>();
  for (const summary of summaries) {
    const corridorKey = `${summary.borough}::${deriveCorridorKey(summary.locationLabel)}`;
    corridorGroups.set(corridorKey, (corridorGroups.get(corridorKey) ?? 0) + 1);
  }

  summaries.forEach((item) => {
    const normalizedFrequency = (item.totalCrashes / maxCrashes) * 100;
    const normalizedSeverity = (item.severityScore / maxSeverity) * 100;
    item.prioritizationScore =
      normalizedFrequency * PRIORITY_SCORE_WEIGHTS.frequency +
      normalizedSeverity * (PRIORITY_SCORE_WEIGHTS.injuries + PRIORITY_SCORE_WEIGHTS.fatalities);
    if (item.prioritizationScore >= CATEGORY_THRESHOLDS.high) {
      item.priorityCategory = "high";
      item.urgencyLabel = "Immediate";
    } else if (item.prioritizationScore >= CATEGORY_THRESHOLDS.medium) {
      item.priorityCategory = "medium";
      item.urgencyLabel = "Near-term";
    } else {
      item.priorityCategory = "lower";
      item.urgencyLabel = "Monitor";
    }
    item.topContributingFactors = Array.from(new Set(item.topContributingFactors)).slice(0, 3);
    item.riskDrivers = deriveRiskDrivers(item.topContributingFactors, item.totalCrashes, item.totalInjuries, item.totalFatalities);
    item.datePatterns = summarizeDatePatterns(item.datePatterns);

    const primaryFactor = item.topContributingFactors[0] ?? "No dominant factor identified";
    const peakPattern = item.datePatterns[0] ?? "No recurring monthly pattern";
    const boroughAverage = boroughGroups.get(item.borough)?.reduce((sum, location) => sum + location.totalCrashes, 0) ?? 0;
    const boroughLocationCount = boroughGroups.get(item.borough)?.length ?? 1;
    item.boroughAverageCrashes = boroughLocationCount > 0 ? boroughAverage / boroughLocationCount : 0;

    const aboveAverage = item.totalCrashes - item.boroughAverageCrashes;
    item.peerComparison =
      aboveAverage > 0
        ? `${aboveAverage.toFixed(1)} crashes above the borough average`
        : aboveAverage < 0
        ? `${Math.abs(aboveAverage).toFixed(1)} crashes below the borough average`
        : "In line with the borough average";

    const corridorKey = `${item.borough}::${deriveCorridorKey(item.locationLabel)}`;
    const corridorCount = corridorGroups.get(corridorKey) ?? 1;
    item.corridorContext =
      corridorCount > 1
        ? `Shared corridor risk: ${corridorCount} locations in this corridor exceed the usual local pattern.`
        : "Isolated hotspot: this site is not clustering with nearby corridor locations.";

    item.investigationSignals = [
      `${item.totalCrashes} recorded crashes`,
      `${item.totalInjuries} injuries`,
      `${item.totalFatalities} fatalities`,
      `Peer benchmark: ${item.peerComparison}`,
      `Primary factor: ${primaryFactor}`,
      `Peak pattern: ${peakPattern}`,
      `Corridor context: ${item.corridorContext}`,
    ];

    item.riskNarrative = `${item.locationLabel} has ${item.totalCrashes} crashes and ${item.totalInjuries + item.totalFatalities} severe outcomes in the selected period. It sits ${item.peerComparison.toLowerCase()} and ${item.corridorContext.toLowerCase()}. The most repeated pattern is ${primaryFactor.toLowerCase()}, with the strongest concentration in ${peakPattern}.`;

    if (item.priorityCategory === "high") {
      item.actionRecommendation = "Prioritize an engineering and enforcement review immediately. Check signal timing, visibility, crossing conditions, and speed management near this location.";
    } else if (item.priorityCategory === "medium") {
      item.actionRecommendation = "Schedule a targeted safety study and review whether control devices or design changes could reduce repeat injury crashes.";
    } else {
      item.actionRecommendation = "Continue monitoring this location and compare against nearby corridors for repeat patterns before allocating a larger intervention.";
    }

    item.recommendedIntervention = buildRecommendedIntervention(item.riskDrivers, item.priorityCategory);
  });

  summaries.sort((a, b) => b.prioritizationScore - a.prioritizationScore);
  summaries.forEach((item, index) => {
    item.rank = index + 1;
  });

  return {
    locationSummaries: summaries,
    filteredRecords: cleaned,
  };
}

function summarizeDatePatterns(dates: string[]) {
  const counts = dates.reduce<Record<string, number>>((acc, date) => {
    if (!date) return acc;
    const month = date.slice(0, 7);
    acc[month] = (acc[month] ?? 0) + 1;
    return acc;
  }, {});

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, 2).map(([month, count]) => `${month}: ${count} crashes`);
}

function deriveRiskDrivers(
  factors: string[],
  totalCrashes: number,
  totalInjuries: number,
  totalFatalities: number
): string[] {
  const derived = new Set<string>();

  for (const factor of factors) {
    const normalized = factor.toLowerCase();

    if (normalized.includes("yield") || normalized.includes("stop") || normalized.includes("signal")) {
      derived.add("Intersection control and compliance");
    }
    if (normalized.includes("speed") || normalized.includes("following") || normalized.includes("traffic") || normalized.includes("lane")) {
      derived.add("Speed and lane discipline");
    }
    if (normalized.includes("pedestrian") || normalized.includes("bicycl") || normalized.includes("cross")) {
      derived.add("Pedestrian and bicyclist exposure");
    }
    if (normalized.includes("distraction") || normalized.includes("fatigue") || normalized.includes("attention")) {
      derived.add("Driver attention and distraction");
    }
  }

  if (totalFatalities > 0 || totalInjuries > 0) {
    derived.add("Severe injury pattern");
  }

  if (totalCrashes >= 5) {
    derived.add("Repeat crash concentration");
  }

  return Array.from(derived).slice(0, 4);
}

function buildRecommendedIntervention(riskDrivers: string[], priorityCategory: "high" | "medium" | "lower") {
  if (riskDrivers.includes("Pedestrian and bicyclist exposure")) {
    return "Implement pedestrian crossing upgrades, visibility improvements, and targeted enforcement focused on yielding and compliance.";
  }
  if (riskDrivers.includes("Intersection control and compliance")) {
    return "Review signal timing, stop control visibility, and right-of-way compliance with a targeted intersection safety study.";
  }
  if (riskDrivers.includes("Speed and lane discipline")) {
    return "Add speed management measures and lane discipline enforcement to reduce repeat high-speed conflict events.";
  }
  if (riskDrivers.includes("Driver attention and distraction")) {
    return "Pair focused enforcement with driver education and targeted messaging at the most frequent conflict points.";
  }

  if (priorityCategory === "high") {
    return "Prioritize a corridor-level engineering review and operational changes at this location.";
  }

  return "Continue monitoring and compare this location with nearby hotspots before funding a broader redesign.";
}

function deriveCorridorKey(locationLabel: string) {
  const cleaned = locationLabel
    .replace(/\s*\(.*?\)\s*/g, "")
    .replace(/\s*&\s*/g, " ")
    .trim();

  const segments = cleaned.split(/\s+/);
  if (segments.length <= 2) {
    return cleaned.toLowerCase();
  }

  return segments.slice(0, 2).join(" ").toLowerCase();
}
