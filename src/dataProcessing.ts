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
  datePatterns: string[];
  investigationSignals: string[];
  riskNarrative: string;
  actionRecommendation: string;
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
        datePatterns: [record.crashDate],
        investigationSignals: [],
        riskNarrative: "",
        actionRecommendation: "Monitor pattern and review nearby crash history.",
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
    item.datePatterns = summarizeDatePatterns(item.datePatterns);

    const primaryFactor = item.topContributingFactors[0] ?? "No dominant factor identified";
    const peakPattern = item.datePatterns[0] ?? "No recurring monthly pattern";
    const severitySignal = item.totalFatalities > 0 ? "fatality risk" : item.totalInjuries > 0 ? "injury risk" : "crash concentration";

    item.investigationSignals = [
      `${item.totalCrashes} recorded crashes`,
      `${item.totalInjuries} injuries`,
      `${item.totalFatalities} fatalities`,
      `Primary factor: ${primaryFactor}`,
      `Peak pattern: ${peakPattern}`,
    ];

    item.riskNarrative = `${item.locationLabel} has ${item.totalCrashes} crashes and ${item.totalInjuries + item.totalFatalities} severe outcomes in the selected period. The most repeated pattern is ${primaryFactor.toLowerCase()}, with the strongest concentration in ${peakPattern}.`;

    if (item.priorityCategory === "high") {
      item.actionRecommendation = "Prioritize an engineering and enforcement review immediately. Check signal timing, visibility, crossing conditions, and speed management near this location.";
    } else if (item.priorityCategory === "medium") {
      item.actionRecommendation = "Schedule a targeted safety study and review whether control devices or design changes could reduce repeat injury crashes.";
    } else {
      item.actionRecommendation = "Continue monitoring this location and compare against nearby corridors for repeat patterns before allocating a larger intervention.";
    }
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
