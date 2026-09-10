# Southern Skies Agritech project instructions

## Repositories

The platform consists of two separate repositories:

- Website: `~/southern-skies-website`
- Admin tool: `~/ssa-admin-tool`

Do not merge the applications or duplicate one application’s architecture inside the other.

The canonical website map viewer is:

```text
~/southern-skies-website/maps/app/
```

Inspect live Git state before relying on documentation or previous handovers. The repositories are authoritative.

## Mapping invariants

- The website is a static HTML/CSS/JavaScript MapLibre GL JS application.
- Survey raster tiles use TMS.
- Preserve `scheme: L.scheme || "tms"` or equivalent behaviour.
- Survey bounds and metadata use EPSG:4326 longitude/latitude.
- Measurement geometry is an SVG overlay above MapLibre.
- Preserve Satellite, Map, RGB, NDVI, GNDVI and Relief map products.
- Preserve 2D/3D terrain.
- Preserve integrated Compare/swipe behaviour.
- Preserve the survey-history sliders.
- Preserve shared SSAUI behaviour.
- Do not undertake broad refactoring during narrow feature work.

## T50 classification

T50 data is separate from Mavic survey imagery.

Every T50 artifact must be classified as one of:

- Prescription.
- Planned route/application.
- Actual completed operation.

Never represent planned or prescribed data as actual, flown, treated, applied or completed without authoritative execution evidence.

Raw DJI files are private source material. Never publish them directly. Public outputs must be sanitized, derived assets.

## Source-data safety

Treat source imagery, controller extractions and flight data as irreplaceable and read-only unless the owner explicitly authorizes another operation.

Do not edit, rename, move or delete source files. Do not convert files in place.

Use separate working/output directories. Preserve original filenames, directory structure and provenance.

## Git and deployment

- Inspect Git status and recent commits before editing.
- Preserve unrelated user changes.
- Perform experimental work on a feature branch/worktree.
- Do not push experimental changes directly to production `main`.
- Do not upload to production R2 or deploy production without explicit authorization.
- Run `git diff --check` and appropriate syntax checks.
- Visually test viewer changes in a real browser where available.
- Static DOM checks alone do not prove that a UI feature is visible or functional.
- Report changed files, validation results and remaining limitations before requesting publication approval.

## Privacy

Do not publish:

- Customer or operator names.
- DJI account values.
- Aircraft/controller serial numbers.
- Internal DJI UUIDs and task identifiers.
- Raw controller logs.
- Home/take-off locations unless explicitly required.
- Chemical and commercial application records beyond the approved public requirement.

Use pseudonymous public IDs and publish only the minimum necessary data.