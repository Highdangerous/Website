# Personal Website

A simple, fast personal site — plain HTML, CSS and JavaScript. No build step, no frameworks.

## Files

- `index.html` — all the content (name, about, projects, contact links)
- `style.css` — colors, fonts, layout (change `--accent` at the top to change the main color)
- `script.js` — dark mode toggle and scroll animations

## Preview locally

Just open `index.html` in your browser, or run:

```sh
python3 -m http.server 8000
```

and visit http://localhost:8000.

## Put it online (free) with GitHub Pages

1. Merge this into the `main` branch.
2. On GitHub, go to **Settings → Pages**.
3. Under **Source**, pick **Deploy from a branch**, choose `main` and `/ (root)`, and save.
4. After a minute your site is live at `https://<your-username>.github.io/<repo-name>/`.
