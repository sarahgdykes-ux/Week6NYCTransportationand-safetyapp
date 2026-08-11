import type { RiskSummaryFilters } from "./dataProcessing";

const BOROUGHS = ["", "MANHATTAN", "BROOKLYN", "QUEENS", "BRONX", "STATEN ISLAND"];

export default function FiltersPanel({
  filters,
  onChange,
  disabled,
}: {
  filters: RiskSummaryFilters;
  onChange: (filters: RiskSummaryFilters) => void;
  disabled: boolean;
}) {
  return (
    <section className="filters-panel">
      <div className="filter-group">
        <label>
          Start date
          <input
            type="date"
            value={filters.startDate}
            onChange={(event) => onChange({ ...filters, startDate: event.target.value })}
            disabled={disabled}
          />
        </label>
        <label>
          End date
          <input
            type="date"
            value={filters.endDate}
            onChange={(event) => onChange({ ...filters, endDate: event.target.value })}
            disabled={disabled}
          />
        </label>
      </div>
      <div className="filter-group">
        <label>
          Borough
          <select
            value={filters.borough}
            onChange={(event) => onChange({ ...filters, borough: event.target.value })}
            disabled={disabled}
          >
            {BOROUGHS.map((borough) => (
              <option key={borough} value={borough}>
                {borough === "" ? "All boroughs" : borough}
              </option>
            ))}
          </select>
        </label>
        <label>
          Severity
          <select
            value={filters.severity}
            onChange={(event) => onChange({ ...filters, severity: event.target.value as any })}
            disabled={disabled}
          >
            <option value="all">All crashes</option>
            <option value="injuries">Injuries only</option>
            <option value="fatalities">Fatalities only</option>
          </select>
        </label>
      </div>
    </section>
  );
}
