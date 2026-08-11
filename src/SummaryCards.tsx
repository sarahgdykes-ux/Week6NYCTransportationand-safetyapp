export default function SummaryCards({
  totalCrashes,
  totalInjuries,
  totalFatalities,
  highPriorityLocations,
}: {
  totalCrashes: number;
  totalInjuries: number;
  totalFatalities: number;
  highPriorityLocations: number;
}) {
  return (
    <div className="summary-cards">
      <div className="summary-card">
        <p className="summary-label">Crashes analyzed</p>
        <p className="summary-value">{totalCrashes}</p>
      </div>
      <div className="summary-card">
        <p className="summary-label">Total injuries</p>
        <p className="summary-value">{totalInjuries}</p>
      </div>
      <div className="summary-card">
        <p className="summary-label">Total fatalities</p>
        <p className="summary-value">{totalFatalities}</p>
      </div>
      <div className="summary-card">
        <p className="summary-label">High-priority locations</p>
        <p className="summary-value">{highPriorityLocations}</p>
      </div>
    </div>
  );
}
