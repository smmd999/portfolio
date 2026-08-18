# Sarmad Ahmad — Portfolio

Static portfolio implementation based on the Figma file supplied in chat.

## Local preview

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Structure

- `index.html` — semantic page structure and gallery content
- `styles.css` — responsive layout, motion, and lightbox styling
- `script.js` — scroll reveals, image loading transitions, keyboard/touch lightbox
- `assets/thumb` — optimized gallery images
- `assets/full` — higher-resolution lightbox images

The site has no build step or runtime dependency, so it can be deployed to Vercel as a static project.
