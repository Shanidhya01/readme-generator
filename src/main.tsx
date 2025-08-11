import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"

// Initialize theme from localStorage or system preference
(function initTheme() {
  const stored = localStorage.getItem("theme")
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  const isDark = stored ? stored === "dark" : prefersDark
  document.documentElement.classList.toggle("dark", isDark)
  document.documentElement.style.colorScheme = isDark ? "dark" : "light"
})()

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
