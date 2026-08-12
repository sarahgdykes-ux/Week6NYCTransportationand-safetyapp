import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  fetchCollisionRecords,
  type CollisionRecord,
} from "./dataApi";
import {
  buildActionPlan,
  buildLocationRiskSummary,
  buildOperationalBrief,
  type LocationRiskSummary,
  type RiskSummaryFilters,
  type CleanupResult,
  defaultFilters,
} from "./dataProcessing";
import MapView from "./MapView";
import FiltersPanel from "./FiltersPanel";
import SummaryCards from "./SummaryCards";
import LocationDetails from "./LocationDetails";
import LoadingPanel from "./LoadingPanel";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";

const WATCHLIST_STORAGE_KEY = "nyc-safety-watchlist";
const WATCHLIST_STATUS_VALUES = ["investigate", "monitor", "escalate"] as const;

type WatchlistStatus = "investigate" | "monitor" | "escalate";

function App() {
  const [records, setRecords] = useState<CollisionRecord[] | null>(null);
  const [filteredRecords, setFilteredRecords] = useState<CollisionRecord[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationRiskSummary | null>(null);
  const [filters, setFilters] = useState<RiskSummaryFilters>(defaultFilters);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cleanup, setCleanup] = useState<CleanupResult | null>(null);
  const [watchlist, setWatchlist] = useState<Record<string, WatchlistStatus>>(() => {
    if (typeof window === "undefined") {
      return {};
    }

    try {
      const stored = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (!stored) {
        return {};
      }

      const parsed = JSON.parse(stored) as Record<string, unknown>;
      return Object.entries(parsed).reduce<Record<string, WatchlistStatus>>((acc, [key, value]) => {
        if (typeof value === "string" && WATCHLIST_STATUS_VALUES.includes(value as WatchlistStatus)) {
          acc[key] = value as WatchlistStatus;
        }
        return acc;
      }, {});
    } catch {
      return {};
    }
  });

  const loadRecords = async () => {
    setStatus("loading");
    setErrorMessage(null);
    setCleanup(null);
    setSelectedLocation(null);

    try {
      const data = await fetchCollisionRecords(filters);
      setRecords(data.records);
      setCleanup(data.cleanup);
      setStatus("success");
    } catch (error) {
      setRecords(null);
      setFilteredRecords([]);
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load NYC collision data."
      );
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  useEffect(() => {
    if (!records) return;
    const summary = buildLocationRiskSummary(records, filters);
    setFilteredRecords(summary.filteredRecords);
    if (
      selectedLocation &&
      !summary.locationSummaries.some((item) => item.locationKey === selectedLocation.locationKey)
    ) {
      setSelectedLocation(null);
    }
  }, [records, filters]);

  const locationSummaries = useMemo(() => {
    if (!records) return [];
    return buildLocationRiskSummary(records, filters).locationSummaries;
  }, [records, filters]);

  const totalCrashes = useMemo(
    () => filteredRecords.length,
    [filteredRecords]
  );

  const totalInjuries = useMemo(
    () => filteredRecords.reduce((sum, record) => sum + record.numberOfPersonsInjured, 0),
    [filteredRecords]
  );

  const totalFatalities = useMemo(
    () => filteredRecords.reduce((sum, record) => sum + record.numberOfPersonsKilled, 0),
    [filteredRecords]
  );

  const highPriorityLocations = useMemo(
    () => locationSummaries.filter((summary) => summary.priorityCategory === "high").length,
    [locationSummaries]
  );

  const priorityQueue = useMemo(
    () => locationSummaries.slice(0, 5),
    [locationSummaries]
  );

  const operationalBrief = useMemo(
    () => buildOperationalBrief(locationSummaries.slice(0, 3)),
    [locationSummaries]
  );

  const actionPlan = useMemo(
    () => buildActionPlan(locationSummaries.slice(0, 3)),
    [locationSummaries]
  );

  const watchlistLocations = useMemo(
    () => locationSummaries.filter((location) => watchlist[location.locationKey]),
    [locationSummaries, watchlist]
  );

  const watchlistCounts = useMemo(
    () => ({
      investigate: Object.values(watchlist).filter((status) => status === "investigate").length,
      monitor: Object.values(watchlist).filter((status) => status === "monitor").length,
      escalate: Object.values(watchlist).filter((status) => status === "escalate").length,
    }),
    [watchlist]
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
    } catch {
      // Ignore storage failures in restricted browser contexts.
    }
  }, [watchlist]);

  const toggleWatchlistLocation = (location: LocationRiskSummary) => {
    setWatchlist((current) => {
      const next = { ...current };
      if (next[location.locationKey]) {
        delete next[location.locationKey];
        return next;
      }
      next[location.locationKey] = "investigate";
      return next;
    });
  };

  const updateWatchlistStatus = (locationKey: string, nextStatus: WatchlistStatus) => {
    setWatchlist((current) => ({
      ...current,
      [locationKey]: nextStatus,
    }));
  };

  const clearWatchlist = () => {
    setWatchlist({});
  };

  const canShowMap = status === "success" && locationSummaries.length > 0;

  return (
    <div className="app-shell">
      <header className="header">
        <div>
          <p className="eyebrow">NYC transportation & safety planner</p>
          <h1>Crash priority map</h1>
          <p className="intro">
            Identify NYC crash locations that deserve attention first by combining crash frequency,
            injuries, and fatalities into a simple prioritization score.
          </p>
          <p className="data-status">
            Data source: NYC Motor Vehicle Collisions API.
            {status === "loading" && " Loading most recent records..."}
            {status === "success" && cleanup && (
              <span>
                Processed {cleanup.validRecords} usable crashes. {cleanup.invalidCount} records were excluded for invalid or incomplete data.
              </span>
            )}
          </p>
        </div>
        <button className="retry-button" onClick={loadRecords} disabled={status === "loading"}>
          Reload data
        </button>
      </header>

      <FiltersPanel
        filters={filters}
        onChange={setFilters}
        disabled={status === "loading"}
      />

      <main className="main-grid">
        <section className="summary-panel">
          {status === "loading" && <LoadingPanel />}
          {status === "error" && <ErrorState message={errorMessage} onRetry={loadRecords} />}
          {status === "success" && (
            <>
              <SummaryCards
                totalCrashes={totalCrashes}
                totalInjuries={totalInjuries}
                totalFatalities={totalFatalities}
                highPriorityLocations={highPriorityLocations}
              />
              {locationSummaries.length === 0 ? (
                <EmptyState
                  title="No crash locations match the selected filters"
                  description="Try expanding the date range or removing borough filters."
                />
              ) : (
                <>
                  <section className="brief-panel">
                    <h2>Operational briefing</h2>
                    <p className="brief-headline">{operationalBrief.headline}</p>
                    <ul className="brief-takeaways">
                      {operationalBrief.keyTakeaways.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    <div className="brief-actions">
                      {operationalBrief.recommendedActions.map((action) => (
                        <div key={action} className="brief-action-item">
                          {action}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="action-plan-panel">
                    <h2>Field action plan</h2>
                    <p className="action-plan-headline">{actionPlan.headline}</p>
                    <div className="action-plan-list">
                      {actionPlan.actions.map((item) => (
                        <div key={item.location} className="action-plan-item">
                          <div className="action-plan-top">
                            <strong>{item.location}</strong>
                            <span className={`risk-pill ${item.urgency === "Immediate" ? "high" : item.urgency === "Near-term" ? "medium" : "lower"}`}>
                              {item.urgency}
                            </span>
                          </div>
                          <p>{item.task}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="priority-queue">
                    <h2>Priority investigation queue</h2>
                    <div className="queue-list">
                      {priorityQueue.map((location) => (
                        <button
                          key={location.locationKey}
                          type="button"
                          className={
                            location.locationKey === selectedLocation?.locationKey ? "queue-item selected" : "queue-item"
                          }
                          onClick={() => setSelectedLocation(location)}
                        >
                          <div className="queue-header">
                            <span className="location-rank">#{location.rank}</span>
                            <strong>{location.locationLabel}</strong>
                          </div>
                          <div className="queue-action-label">Recommended focus</div>
                          <p>{location.recommendedIntervention}</p>
                          <div className="queue-meta">
                            <span className={`risk-pill ${location.priorityCategory}`}>
                              {location.urgencyLabel}
                            </span>
                            <span>{location.totalCrashes} crashes</span>
                            <span>{location.totalInjuries} injuries</span>
                          </div>
                          <div className="tag-row">
                            {location.riskDrivers.map((driver) => (
                              <span key={driver} className="detail-tag">
                                {driver}
                              </span>
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="watchlist-panel">
                    <div className="watchlist-header">
                      <h2>Watchlist</h2>
                      <div className="watchlist-actions">
                        <span>{watchlistLocations.length} tracked</span>
                        <button type="button" className="clear-watchlist-button" onClick={clearWatchlist}>
                          Clear all
                        </button>
                      </div>
                    </div>
                    <div className="status-summary">
                      <span className="status-chip investigate">{watchlistCounts.investigate} investigate</span>
                      <span className="status-chip monitor">{watchlistCounts.monitor} monitor</span>
                      <span className="status-chip escalate">{watchlistCounts.escalate} escalate</span>
                    </div>
                    {watchlistLocations.length === 0 ? (
                      <p className="section-copy">Add a hotspot to keep it in your investigation queue.</p>
                    ) : (
                      <div className="watchlist-items">
                        {watchlistLocations.map((location) => (
                          <div key={location.locationKey} className="watchlist-item">
                            <button type="button" className="watchlist-name" onClick={() => setSelectedLocation(location)}>
                              {location.locationLabel}
                            </button>
                            <select
                              value={watchlist[location.locationKey]}
                              onChange={(event) =>
                                updateWatchlistStatus(location.locationKey, event.target.value as "investigate" | "monitor" | "escalate")
                              }
                            >
                              <option value="investigate">Investigate</option>
                              <option value="monitor">Monitor</option>
                              <option value="escalate">Escalate</option>
                            </select>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="location-list">
                    <h2>Top crash locations</h2>
                    <p className="section-copy">
                      Locations are ranked using an MVP prioritization score that balances crash frequency
                      with injury and fatality severity.
                    </p>
                    <ol className="location-items">
                      {locationSummaries.slice(0, 8).map((location) => (
                        <li
                          key={location.locationKey}
                          className={
                            location.locationKey === selectedLocation?.locationKey ? "location-item selected" : "location-item"
                          }
                          onClick={() => setSelectedLocation(location)}
                        >
                          <div>
                            <span className="location-rank">#{location.rank}</span>
                            <strong>{location.locationLabel}</strong>
                            <span className="location-borough">{location.borough}</span>
                          </div>
                          <div className="location-metrics">
                            <span>{location.totalCrashes} crashes</span>
                            <span>{location.totalInjuries} injuries</span>
                            <span>{location.totalFatalities} fatalities</span>
                          </div>
                          <span className={`risk-pill ${location.priorityCategory}`}>
                            {location.priorityCategory === "high" ? "High priority" : location.priorityCategory === "medium" ? "Medium priority" : "Lower priority"}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </section>
                </>
              )}
            </>
          )}
        </section>

        <section className="map-panel">
          {status === "success" && canShowMap ? (
            <MapView
              locations={locationSummaries}
              selectedLocationKey={selectedLocation?.locationKey ?? null}
              onLocationSelect={(key) => {
                const found = locationSummaries.find((item) => item.locationKey === key);
                if (found) setSelectedLocation(found);
              }}
            />
          ) : (
            <div className="map-placeholder">
              {status === "loading"
                ? "Map will appear once NYC collision data has been loaded."
                : locationSummaries.length === 0
                ? "No usable location data is available yet."
                : "Map is unavailable."}
            </div>
          )}

          {status === "success" && selectedLocation && (
            <LocationDetails
              location={selectedLocation}
              isInWatchlist={Boolean(watchlist[selectedLocation.locationKey])}
              onToggleWatchlist={() => toggleWatchlistLocation(selectedLocation)}
              watchlistStatus={watchlist[selectedLocation.locationKey] ?? "investigate"}
              onStatusChange={(nextStatus) => updateWatchlistStatus(selectedLocation.locationKey, nextStatus)}
            />
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
