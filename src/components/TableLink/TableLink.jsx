import "./TableLink.css";

/* Blue clickable text inside a table cell (order no., customer name, ...) */
export default function TableLink({ children, onClick }) {
  return (
    <a
      href="#"
      className="table-link"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation(); // row selection trigger aagama irukka
        onClick?.(e);
      }}
    >
      {children}
    </a>
  );
}