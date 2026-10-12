// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// Dark mode: remember choice, otherwise follow system setting
const root = document.documentElement;
const toggle = document.getElementById("theme-toggle");

function getSavedTheme() {
  try { return localStorage.getItem("theme"); } catch { return null; }
}

// Dark by default; only switch to light if the visitor chose it
root.dataset.theme = getSavedTheme() || "dark";

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

// Posts: edit this list to add or change posts
const POSTS = [
  {
    id: "first-post",
    date: "Oct 2026",
    title: "Hello, world",
    excerpt: "Why I built my own site instead of using a template.",
    body: [
      "I wanted a place that's mine. No platform rules, no algorithm, just a page I control.",
      "This is the first of many posts. I'll write about what I'm learning and building.",
    ],
  },
  {
    id: "second-post",
    date: "Oct 2026",
    title: "Things I'm learning",
    excerpt: "A short list of what's on my mind this month.",
    body: [
      "Replace this with your own thoughts. Short paragraphs work best online.",
    ],
  },
];

// Likes and comments are stored in this browser only (localStorage).
// They are not shared with other visitors until a backend is connected.
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
};

const postList = document.getElementById("post-list");
const dialog = document.getElementById("post-dialog");
const likeBtn = document.getElementById("post-like");
const likeCount = document.getElementById("like-count");
const commentList = document.getElementById("comment-list");
const commentForm = document.getElementById("comment-form");
let activePost = null;

function renderPostCards() {
  postList.innerHTML = POSTS.map((post) => {
    const likes = store.get(`likes:${post.id}`, 0);
    const comments = store.get(`comments:${post.id}`, []).length;
    return `
      <article class="card post-card" tabindex="0" data-id="${post.id}">
        <p class="post-meta">${post.date}</p>
        <h3>${post.title}</h3>
        <p>${post.excerpt}</p>
        <p class="stats">♡ ${likes} · 💬 ${comments}</p>
      </article>`;
  }).join("");
}

function openPost(post) {
  activePost = post;
  document.getElementById("post-meta").textContent = post.date;
  document.getElementById("post-title").textContent = post.title;
  document.getElementById("post-body").innerHTML = post.body.map((p) => `<p>${p}</p>`).join("");
  renderLike();
  renderComments();
  commentForm.reset();
  dialog.showModal();
}

function renderLike() {
  const liked = store.get(`liked:${activePost.id}`, false);
  likeBtn.setAttribute("aria-pressed", liked);
  likeBtn.firstChild.textContent = liked ? "♥ " : "♡ ";
  likeCount.textContent = store.get(`likes:${activePost.id}`, 0);
}

function renderComments() {
  const comments = store.get(`comments:${activePost.id}`, []);
  commentList.innerHTML = comments.length
    ? comments.map((c) => `
        <li>
          <strong>${escapeHtml(c.name)}</strong>
          <time>${c.date}</time>
          <p>${escapeHtml(c.text)}</p>
        </li>`).join("")
    : `<li class="none">No comments yet. Be the first!</li>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

likeBtn.addEventListener("click", () => {
  const key = `liked:${activePost.id}`;
  const liked = !store.get(key, false);
  const count = store.get(`likes:${activePost.id}`, 0) + (liked ? 1 : -1);
  store.set(key, liked);
  store.set(`likes:${activePost.id}`, Math.max(0, count));
  renderLike();
  renderPostCards();
});

commentForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const key = `comments:${activePost.id}`;
  const comments = store.get(key, []);
  comments.unshift({
    name: document.getElementById("comment-name").value.trim(),
    text: document.getElementById("comment-text").value.trim(),
    date: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
  });
  store.set(key, comments);
  commentForm.reset();
  renderComments();
  renderPostCards();
});

postList.addEventListener("click", (e) => {
  const card = e.target.closest(".post-card");
  if (card) openPost(POSTS.find((p) => p.id === card.dataset.id));
});
postList.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.classList.contains("post-card")) {
    openPost(POSTS.find((p) => p.id === e.target.dataset.id));
  }
});

document.getElementById("post-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });

renderPostCards();
