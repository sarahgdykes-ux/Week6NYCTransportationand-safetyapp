import { formatISO } from "date-fns";

export type LocationField = {
  latitude?: string;
  longitude?: string;
  human_address?: string;
};

export type RawCollisionRecord = {
  collision_id?: string;
  crash_date?: string;
  crash_time?: string;
  borough?: string;
  latitude?: string;
  longitude?: string;
  location?: string | LocationField;
  on_street_name?: string;
  cross_street_name?: string;
  number_of_persons_injured?: string;
  number_of_persons_killed?: string;
  contributing_factor_vehicle_1?: string;
  contributing_factor_vehicle_2?: string;
  contributing_factor_vehicle_3?: string;
  contributing_factor_vehicle_4?: string;
  contributing_factor_vehicle_5?: string;
};

export type CollisionRecord = {
  collisionId: string;
  crashDate: string;
  crashTime: string;
  borough: string | null;
  latitude: number;
  longitude: number;
  locationLabel: string;
  numberOfPersonsInjured: number;
  numberOfPersonsKilled: number;
  contributingFactors: string[];
};

export type FetchResult = {
  records: CollisionRecord[];
  cleanup: {
    validRecords: number;
    invalidCount: number;
  };
};

export type FetchParams = {
  startDate?: string;
  endDate?: string;
  borough?: string;
};

const API_BASE = "https://data.cityofnewyork.us/resource/h9gi-nx95.json";
const DEFAULT_LIMIT = 1000;

function buildFilterQuery(params: FetchParams) {
  const clauses: string[] = [];
  if (params.startDate) {
    clauses.push(`crash_date >= '${params.startDate}'`);
  }
  if (params.endDate) {
    clauses.push(`crash_date <= '${params.endDate}'`);
  }
  if (params.borough) {
    clauses.push(`borough = '${params.borough.replace("'", "\\'")}'`);
  }
  return clauses.join(" AND ");
}

export async function fetchCollisionRecords(params: FetchParams): Promise<FetchResult> {
  const whereClause = buildFilterQuery(params);
  const url = new URL(API_BASE);
  const selectFields = [
    "collision_id",
    "crash_date",
    "crash_time",
    "borough",
    "latitude",
    "longitude",
    "location",
    "on_street_name",
    "cross_street_name",
    "number_of_persons_injured",
    "number_of_persons_killed",
    "contributing_factor_vehicle_1",
    "contributing_factor_vehicle_2",
    "contributing_factor_vehicle_3",
    "contributing_factor_vehicle_4",
    "contributing_factor_vehicle_5",
  ];
  url.searchParams.set("$select", selectFields.join(","));
  url.searchParams.set("$limit", DEFAULT_LIMIT.toString());
  url.searchParams.set("$order", "crash_date DESC, crash_time DESC");

  if (whereClause) {
    url.searchParams.set("$where", whereClause);
  }

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load NYC collision data. Please try again.");
  }

  const rawRecords = (await response.json()) as RawCollisionRecord[];
  const records: CollisionRecord[] = [];
  let invalidCount = 0;
  const seenIds = new Set<string>();

  for (const item of rawRecords) {
    if (!item.collision_id || seenIds.has(item.collision_id)) {
      invalidCount += 1;
      continue;
    }

    const date = item.crash_date;
    const time = item.crash_time;
    if (!date || !time) {
      invalidCount += 1;
      continue;
    }

    const parsedDate = new Date(date.includes("T") ? date : `${date}T${time}`);
    if (Number.isNaN(parsedDate.getTime())) {
      invalidCount += 1;
      continue;
    }

    let latitude = parseFloat(item.latitude ?? "");
    let longitude = parseFloat(item.longitude ?? "");
    if ((Number.isNaN(latitude) || Number.isNaN(longitude)) && typeof item.location === "object") {
      latitude = parseFloat(item.location.latitude ?? "");
      longitude = parseFloat(item.location.longitude ?? "");
    }

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      invalidCount += 1;
      continue;
    }

    const numInjured = parseInt(item.number_of_persons_injured ?? "0", 10);
    const numKilled = parseInt(item.number_of_persons_killed ?? "0", 10);
    const factors = [
      item.contributing_factor_vehicle_1,
      item.contributing_factor_vehicle_2,
      item.contributing_factor_vehicle_3,
      item.contributing_factor_vehicle_4,
      item.contributing_factor_vehicle_5,
    ]
      .filter((value): value is string => value != null && value.trim() !== "")
      .map((value) => value.trim());

    records.push({
      collisionId: item.collision_id,
      crashDate: formatISO(parsedDate, { representation: "date" }),
      crashTime: formatISO(parsedDate, { representation: "time" }),
      borough: item.borough ? item.borough.trim() : null,
      latitude,
      longitude,
      locationLabel: typeof item.location === "string" && item.location.trim()
        ? item.location.trim()
        : buildStreetLabel(item),
      numberOfPersonsInjured: Number.isFinite(numInjured) ? numInjured : 0,
      numberOfPersonsKilled: Number.isFinite(numKilled) ? numKilled : 0,
      contributingFactors: factors,
    });
    seenIds.add(item.collision_id);
  }

  console.debug("NYC collision API returned records", {
    count: records.length,
    sample: records.slice(0, 5).map((record) => ({
      collisionId: record.collisionId,
      crashDate: record.crashDate,
      borough: record.borough,
      latitude: record.latitude,
      longitude: record.longitude,
    })),
  });

  return {
    records,
    cleanup: {
      validRecords: records.length,
      invalidCount,
    },
  };
}

function buildStreetLabel(record: RawCollisionRecord) {
  const street = [record.on_street_name, record.cross_street_name]
    .filter((value) => value && value.trim() !== "")
    .join(" & ");
  return street || "Unknown location";
}
