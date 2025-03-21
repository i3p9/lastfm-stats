import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// import App from "./App.jsx";
// import Sup from "./Sup.jsx";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
	<StrictMode>
		<App />{" "}
	</StrictMode>
);
