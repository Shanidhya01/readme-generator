import React from "react"
import { Button } from "@/components/ui/button"

function setTheme(next: "dark" | "light") {
  const root = document.documentElement
  root.classList.toggle("dark", next === "dark")
  // helps native form controls render appropriately
  root.style.colorScheme = next
  localStorage.setItem("theme", next)
}

function getInitialTheme(): "dark" | "light" {
  const stored = localStorage.getItem("theme") as "dark" | "light" | null
  if (stored) return stored
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export default function ThemeToggle() {
  const [theme, setThemeState] = React.useState<"dark" | "light">(getInitialTheme)

  React.useEffect(() => {
    setTheme(theme)
  }, [theme])

  // Sync with system preference only when user hasn't chosen explicitly
  React.useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => {
      if (!localStorage.getItem("theme")) {
        setThemeState(mql.matches ? "dark" : "light")
      }
    }
    if (mql.addEventListener) mql.addEventListener("change", onChange)
    else mql.addListener(onChange)
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange)
      else mql.removeListener(onChange)
    }
  }, [])

  const toggle = () => setThemeState((t) => (t === "dark" ? "light" : "dark"))

  return (
    <div className="fixed top-3 right-3 z-50">
      <Button
        variant="secondary"
        size="icon"
        onClick={toggle}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        className="rounded-full"
      >
        {/* Sun icon (light) */}
        <svg
          viewBox="0 0 24 24"
          className={`h-5 w-5 ${theme === "dark" ? "hidden" : "block"}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 4V2M12 22v-2M4.93 4.93 3.51 3.51M20.49 20.49l-1.42-1.42M4 12H2M22 12h-2M4.93 19.07 3.51 20.49M20.49 3.51l-1.42 1.42" />
          <circle cx="12" cy="12" r="4" />
        </svg>
        {/* Moon icon (dark) */}
        <svg
          viewBox="0 0 24 24"
          className={`h-5 w-5 ${theme === "dark" ? "block" : "hidden"}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </Button>
    </div>
  )
}