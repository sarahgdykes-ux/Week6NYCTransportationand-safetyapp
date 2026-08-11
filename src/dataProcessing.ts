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
  topContributingFactors: string[];
  datePatterns: string[];
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
    .filter((record) => record.borough && record.locationLabel && !Number.isNaN(record.latitude) && !Number.isNaN(record.longitude));

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
        topContributingFactors: contributingFactors,
        datePatterns: [record.crashDate],
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
    } else if (item.prioritizationScore >= CATEGORY_THRESHOLDS.medium) {
      item.priorityCategory = "medium";
    } else {
      item.priorityCategory = "lower";
    }
    item.topContributingFactors = Array.from(new Set(item.topContributingFactors)).slice(0, 3);
    item.datePatterns = summarizeDatePatterns(item.datePatterns);
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
