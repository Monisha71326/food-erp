import { useEffect, useRef } from "react";
import "./SearchBar.css";

export default function SearchBar({ placeholder = "Search products, orders, customers, suppliers...", onSearch }) {
  const inputRef = useRef(null);

  // Ctrl + K => focus
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="gs-search">
      <i className="fa-solid fa-magnifying-glass gs-icon" aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        className="gs-input"
        placeholder={placeholder}
        onChange={(e) => onSearch?.(e.target.value)}
        aria-label="Search"
      />
      <kbd className="gs-kbd">Ctrl + K</kbd>
    </div>
  );
}