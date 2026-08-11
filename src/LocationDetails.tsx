import type { LocationRiskSummary } from "./dataProcessing";

export default function LocationDetails({ location }: { location: LocationRiskSummary }) {
  return (
    <section className="location-details">
      <h2>Selected location</h2>
      <div className="detail-row">
        <span>Location</span>
        <strong>{location.locationLabel}</strong>
      </div>
      <div className="detail-row">
        <span>Borough</span>
        <strong>{location.borough}</strong>
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
      <div className="detail-row detail-factors">
        <span>Common contributing factors</span>
        <strong>{location.topContributingFactors.join(", ") || "Not available"}</strong>
      </div>
      <div className="detail-row detail-patterns">
        <span>Recent crash pattern</span>
        <ul>
          {location.datePatterns.map((pattern) => (
            <li key={pattern}>{pattern}</li>
          ))}
        </ul>
      </div>
      <p className="method-note">
        The MVP prioritization score combines crash frequency and severity, with fatalities weighted higher than injuries.
      </p>
    </section>
  );
}
