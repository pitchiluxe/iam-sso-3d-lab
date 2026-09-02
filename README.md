# IAM & SSO 3D Lab — Landing Page

A static landing page for the IAM & SSO 3D Lab, ready for GitHub Pages.

Created by **Erick Omari**.

## Files

- `index.html` — the page
- `styles.css` — single stylesheet
- `favicon.svg` — shield + padlock monogram
- `assets/Erick.jpg` — author portrait
- `404.html` — fallback for any bad path on GitHub Pages

## Local preview

```sh
# From this directory:
python -m http.server 8080
# then open http://localhost:8080
```

Or just open `index.html` directly in a browser — no build step.

## Publish to GitHub Pages

This `landing-page/` folder is its own static site. The recommended way to publish
it is to push **just this folder** to a dedicated repo on `github.com/pitchiluxe`,
then enable GitHub Pages on that repo (Settings → Pages → Branch: `main`, Folder: `/`).

### One-time setup on github.com

1. Create a new repository on `github.com/pitchiluxe`. Suggested name: `iam-sso-3d-lab-site`
   (or `pitchiluxe.github.io` if you want it served from the user root).
2. **Do not** initialize it with a README, .gitignore, or license — we'll push
   an empty repo.

### Push the site from this folder

```sh
cd landing-page
git init
git add .
git commit -m "Initial landing page"
git branch -M main
git remote add origin https://github.com/pitchiluxe/<repo-name>.git
git push -u origin main
```

### Turn on GitHub Pages

1. On the repo page, go to **Settings → Pages**.
2. Under **Source**, pick **Deploy from a branch**.
3. Choose **Branch: `main`**, **Folder: `/ (root)`**.
4. Save. The site will be live at:

   - `https://pitchiluxe.github.io/<repo-name>/` — if you used a project repo
   - `https://pitchiluxe.github.io/` — if you used the user root repo

## Pointing a custom domain

If you later add a `CNAME` file containing your domain, GitHub Pages will
serve the site at that domain automatically. Add the file at the root of this
folder, then update DNS per the [GitHub Pages custom domain docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site).

## Updating the page

Edit the file, then:

```sh
cd landing-page
git add -A
git commit -m "Update landing page"
git push
```

GitHub Pages rebuilds automatically within a minute or two.

## Notes

- All credentials, usernames, domain names, and company entities shown in the
  app and its marketing are fictional.
- The actual IAM & SSO 3D Lab source (Vite + Three.js + Electron) lives in the
  parent `app/` directory and is packaged separately as a Windows NSIS
  installer. This landing page only links to GitHub.
