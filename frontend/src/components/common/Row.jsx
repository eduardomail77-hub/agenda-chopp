export default function Row({ label, v }) {
  return (
    <div className="row">
      <span className="rl">{label}</span>
      <span className="rv">{v}</span>
    </div>
  );
}
