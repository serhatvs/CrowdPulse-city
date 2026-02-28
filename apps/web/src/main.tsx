import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

const App = lazy(() => import("./App"));

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Suspense fallback={<div className="app-shell"><div className="status">Loading dashboard...</div></div>}>
      <App />
    </Suspense>
  </React.StrictMode>,
);
