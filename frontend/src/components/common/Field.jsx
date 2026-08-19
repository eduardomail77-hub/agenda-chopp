export default function Field({ label, children, span2 }) {
  return (
    <div className={`field ${span2 ? 's2' : ''}`}>
      <label className="lbl">{label}</label>
      {children}
    </div>
  );
}
