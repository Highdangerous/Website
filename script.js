// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// Dark mode: remember choice, otherwise follow system setting
const root = document.documentElement;
const toggle = document.getElementById("theme-toggle");

function getSavedTheme() {
  try { return localStorage.getItem("theme"); } catch { return null; }
}

const saved = getSavedTheme();
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
root.dataset.theme = saved || (prefersDark ? "dark" : "light");

toggle.addEventListener("click", () => {
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  try { localStorage.setItem("theme", root.dataset.theme); } catch {}
});

// Fade sections in as you scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
