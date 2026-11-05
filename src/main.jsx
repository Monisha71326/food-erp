import React from "react";
import ReactDOM from "react-dom/client";
import "@fortawesome/fontawesome-free/css/all.min.css";

/* Global styles first (order matters: tokens -> base -> shared helpers) */
import "./styles/variables.css";
import "./styles/base.css";
import "./styles/tones.css";
import "./styles/animations.css";
import "./styles/premium.css";
import "./styles/redesign.css";
import "./styles/print.css";

import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
