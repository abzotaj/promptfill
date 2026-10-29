/** Shows what React state actually holds after submit: the proof that filling worked. */
export function Submitted({ data }: { data: object | null }) {
  return (
    <aside className="card submitted">
      <h2>Submitted payload</h2>
      {data ? <pre>{JSON.stringify(data, null, 2)}</pre> : <p className="muted">Fill the form (by hand or with PromptFill), then submit. React's state shows up here.</p>}
    </aside>
  );
}
