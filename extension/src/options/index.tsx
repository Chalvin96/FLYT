import { createRoot } from "react-dom/client";

import "../../tailwind/index.css";

import { SiteAccessPage } from "./SiteAccessPage";

const root = document.getElementById("root");
if (!root) throw new Error("Site access page root is missing");

createRoot(root).render(<SiteAccessPage />);
