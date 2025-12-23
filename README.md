# PDF Flow Pro — Build & Packaging

This repository contains a Vite + React + Electron app. The repository already includes a GitHub Actions workflow to build a Windows NSIS installer (`.exe`) on a Windows runner.

This README explains how to provide application icons, run CI to produce a Windows `.exe`, and build locally (including Wine notes).

## Provide application icons

Place your application icon files under the `assets/` directory in the repository root. Electron Builder expects base name `assets/icon` and will resolve platform-specific formats automatically:

- macOS: `assets/icon.icns`
- Windows: `assets/icon.ico`
- Linux: `assets/icon.png`

If you only have a single PNG, you can generate the other formats using tools like `iconutil` (macOS) and `icotool` (linux/win) or online converters. The `package.json` build config is already set to use `assets/icon` as the base.

## Build in CI (recommended for Windows .exe)

We added a GitHub Actions workflow `.github/workflows/build-windows.yml` that:

- Checks out the repo
- Installs dependencies
- Runs `npm run build` (Vite production build)
- Runs `npm run dist:electron` (electron-builder)
- Creates a zip archive (`artifact-windows.zip`) containing produced artifacts
- Computes a SHA256 checksum file `artifact-windows.zip.sha256`
- Uploads the zip, checksum, and raw outputs as the `windows-installer` artifact

How to run it:

1. Commit and push your repo (including icons in `assets/`).
2. On GitHub, go to Actions → select `Build Windows installer` → click **Run workflow**.
3. When the run completes, download the `windows-installer` artifact from the run page — it will include a single `artifact-windows.zip` and `artifact-windows.zip.sha256` for easy distribution and verification.

Notes:
- Building a Windows installer on a Windows runner ensures a clean, native build. Cross-building from macOS to Windows is possible but more fragile.
- The workflow also uploads raw `dist/` and `release/` folders in case you want to inspect individual files.

## Local Windows build (on Windows)

If you have a Windows machine (recommended), do the following:

```bash
# install deps
npm ci

# build contents
npm run build

# produce installer (this will create installers in dist or release folders)
npm run dist:electron
```

Result: electron-builder will create the NSIS installer (`.exe`) in the output folder (typically `dist` or `release`). Download/run the `.exe` to install the application.

## Local Windows-like build on macOS (NOT recommended)

Cross-building to produce a Windows `.exe` on macOS requires Wine and the NSIS toolchain. It's often error-prone and not supported out-of-the-box by electron-builder without extra tooling.

If you want to try locally on macOS, you'll need:

- Wine / Wine64
- `makensis` (NSIS) available under Wine
- The `wine` binary in PATH so electron-builder can call it

Instructions are environment-dependent and more fragile than CI. I recommend using the GitHub Actions workflow above instead.

## Dev + Electron

Start dev server + Electron (loads `http://localhost:5173`):

```bash
npm run dev:electron
```

## Quick troubleshooting

- If the CI run fails at `electron-builder`, check the logs for missing icons or signing errors.
- If you need code signing for macOS or Windows, add the relevant credentials to GitHub Secrets and update `package.json` build config.

---

If you want, I can:

- Add sample icons to `assets/` (you can replace them with your official icons later). Note: I can only add placeholder files — you'll likely want high-quality images.
- Push a small tweak to the workflow to also produce zipped copies of the installer.
- Run the workflow for you if you push the icons now (I can't trigger GitHub runs from this environment, but I can guide you).

Which do you want me to do next?
<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1ih2sFCFFIlvepzWq_JUA-3cUhIDY3aBI

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
# PDFsetup
