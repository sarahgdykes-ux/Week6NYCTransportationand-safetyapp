export default function LoadingPanel() {
  return (
    <section className="loading-panel">
      <div className="spinner" aria-hidden="true"></div>
      <div>
        <h2>Loading NYC collision data...</h2>
        <p>Fetching recent crash records and preparing location prioritization. This may take a few seconds.</p>
      </div>
    </section>
  );
}
