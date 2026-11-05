import "./ComingSoonPage.css";

/* Shown for every sidebar item that does not have a real page yet */
export default function ComingSoonPage({ title }) {
  return (
    <div className="page-anim">
      <div className="card coming">
        <i className="fa-solid fa-screwdriver-wrench fa-bounce" aria-hidden="true" />
        <h2>{title}</h2>
        <p className="muted">Indha page innum build aagala — coming soon.</p>
      </div>
    </div>
  );
}
