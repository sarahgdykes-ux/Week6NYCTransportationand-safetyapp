import type { LocationRiskSummary } from "./dataProcessing";

export default function LocationDetails({
  location,
  isInWatchlist,
  onToggleWatchlist,
  watchlistStatus,
  onStatusChange,
}: {
  location: LocationRiskSummary;
  isInWatchlist: boolean;
  onToggleWatchlist: () => void;
  watchlistStatus: "investigate" | "monitor" | "escalate";
  onStatusChange: (status: "investigate" | "monitor" | "escalate") => void;
}) {
  return (
    <section className="location-details">
      <div className="detail-header-row">
        <h2>Investigation summary</h2>
        <button type="button" className="watchlist-button" onClick={onToggleWatchlist}>
          {isInWatchlist ? "Remove from watchlist" : "Add to watchlist"}
        </button>
      </div>
      <div className="detail-row">
        <span>Location</span>
        <strong>{location.locationLabel}</strong>
      </div>
      <div className="detail-row">
        <span>Borough</span>
        <strong>{location.borough}</strong>
      </div>
      <div className="detail-row">
        <span>Priority status</span>
        <strong>{location.urgencyLabel}</strong>
      </div>
      <div className="detail-row">
        <span>Watchlist status</span>
        <select value={watchlistStatus} onChange={(event) => onStatusChange(event.target.value as "investigate" | "monitor" | "escalate")}>
          <option value="investigate">Investigate</option>
          <option value="monitor">Monitor</option>
          <option value="escalate">Escalate</option>
        </select>
      </div>
      <div className="detail-row">
        <span>Crash count</span>
        <strong>{location.totalCrashes}</strong>
      </div>
      <div className="detail-row">
        <span>Injuries</span>
        <strong>{location.totalInjuries}</strong>
      </div>
      <div className="detail-row">
        <span>Fatalities</span>
        <strong>{location.totalFatalities}</strong>
      </div>
      <div className="detail-row">
        <span>Prioritization score</span>
        <strong>{Math.round(location.prioritizationScore)}</strong>
      </div>
      <div className="detail-row">
        <span>Peer benchmark</span>
        <strong>{location.peerComparison}</strong>
      </div>
      <div className="detail-row">
        <span>Borough average</span>
        <strong>{location.boroughAverageCrashes.toFixed(1)} crashes/location</strong>
      </div>
      <div className="detail-row">
        <span>Corridor context</span>
        <strong>{location.corridorContext}</strong>
      </div>

      <div className="detail-row detail-factors">
        <span>Risk narrative</span>
        <strong>{location.riskNarrative}</strong>
      </div>

      <div className="detail-row detail-factors">
        <span>Risk drivers</span>
        <div className="tag-row">
          {location.riskDrivers.length > 0 ? (
            location.riskDrivers.map((driver) => (
              <span key={driver} className="detail-tag">
                {driver}
              </span>
            ))
          ) : (
            <span className="empty-tag">Not available</span>
          )}
        </div>
      </div>

      <div className="detail-row detail-factors">
        <span>Common contributing factors</span>
        <strong>{location.topContributingFactors.join(", ") || "Not available"}</strong>
      </div>

      <div className="detail-row detail-patterns">
        <span>Investigation signals</span>
        <ul>
          {location.investigationSignals.map((signal) => (
            <li key={signal}>{signal}</li>
          ))}
        </ul>
      </div>

      <div className="detail-row detail-patterns">
        <span>Recent crash pattern</span>
        <ul>
          {location.datePatterns.map((pattern) => (
            <li key={pattern}>{pattern}</li>
          ))}
        </ul>
      </div>

      <div className="detail-row detail-callout">
        <span>Recommended action</span>
        <strong>{location.actionRecommendation}</strong>
      </div>

      <div className="detail-row detail-callout emphasis">
        <span>Recommended intervention</span>
        <strong>{location.recommendedIntervention}</strong>
      </div>

      <p className="method-note">
        The MVP prioritization score combines crash frequency and severity, with fatalities weighted higher than injuries.
      </p>
    </section>
  );
}
