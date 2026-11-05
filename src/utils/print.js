/*
 * printElement(el, { orientation }): prints ONLY `el` (the page content).
 * Everything else (sidebar, top header, modals ...) is hidden while printing, then restored.
 * The CSS for the classes used here is in src/styles/print.css.
 * The paper orientation is set only for this print job, so other print layouts (e.g. the invoice) are not affected.
 */
export function printElement(el, { orientation = "landscape" } = {}) {
  if (!el) {
    window.print();
    return;
  }

  const touched = [];
  let node = el;

  while (node && node !== document.documentElement) {
    const parent = node.parentElement;
    if (!parent) break;

    // hide every sibling on the way up to <body>
    Array.from(parent.children).forEach((sib) => {
      if (sib !== node && !["SCRIPT", "STYLE", "LINK"].includes(sib.tagName)) {
        sib.classList.add("print-hide");
        touched.push(sib);
      }
    });

    // un-fix height / overflow / grid of the ancestors so the content can flow over many pages
    parent.classList.add("print-flow");
    touched.push(parent);
    node = parent;
  }

  el.classList.add("print-area");
  touched.push(el);

  // paper size / orientation only for this print job
  const pageStyle = document.createElement("style");
  pageStyle.setAttribute("data-print-page", "");
  pageStyle.textContent = `@page { size: A4 ${orientation}; margin: 10mm; }`;
  document.head.appendChild(pageStyle);

  const cleanup = () => {
    touched.forEach((n) => n.classList.remove("print-hide", "print-flow", "print-area"));
    pageStyle.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  window.print();
}