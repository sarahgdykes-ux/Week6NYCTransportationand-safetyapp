export default function ErrorState({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry: () => void;
}) {
  return (
    <section className="error-state">
      <h2>Unable to load collision data</h2>
      <p>{message ?? "There was a problem fetching data from the API."}</p>
      <button onClick={onRetry}>Retry</button>
    </section>
  );
}
