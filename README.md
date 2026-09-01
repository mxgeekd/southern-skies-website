# Southern Skies Agritech — Mapping Platform

Client-facing web mapping and survey delivery platform for **Southern Skies Agritech**.

The platform publishes drone survey imagery, multispectral vegetation indices and historical survey data through private client property portals.

**Production website:** southernskiesagritech.com.au

---

## Overview

The Southern Skies Mapping Platform provides clients with browser-based access to agricultural drone survey data.

Current capabilities include:

- RGB orthomosaic viewing
- NDVI and GNDVI vegetation-index viewing
- Support for additional vegetation indices
- Satellite and street-map basemaps
- Property and paddock navigation
- Historical survey records
- Survey-to-survey comparison
- Swipe comparison
- Satellite-to-survey comparison
- Distance and area measurement
- Polygon drawing
- Survey metadata and paddock descriptions
- Mobile-compatible mapping interface

Survey data is processed locally from DJI Terra outputs and published automatically through the Southern Skies admin tool.

---

## Technology Stack

### Website

- Static HTML / CSS / JavaScript
- MapLibre GL JS
- Cloudflare Pages
- Cloudflare R2
- ArcGIS Basemap Styles API
- OpenStreetMap
- GitHub

### Survey Processing

- DJI Terra
- GDAL
- Python
- AWS CLI
- WSL / Ubuntu

### Administration

A separate local Flask application manages:

- Properties
- Paddocks
- Surveys
- Raster processing
- R2 uploads
- Portal metadata
- Generated portal pages
- Git commits and publishing

The admin application is maintained separately from this website repository.

---

## Repository Structure

```text
southern-skies-website/
├── maps/
│   ├── build.json
│   ├── config.js
│   │
│   ├── view/
│   │   └── index.html
│   │
│   ├── compare/
│   │   └── index.html
│   │
│   ├── ui/
│   │   ├── ssa-ui.css
│   │   └── ssa-ui.js
│   │
│   └── explorer/
│       ├── explorer.css
│       └── explorer.js
│
└── portal/
    └── <property-id>/
        ├── index.html
        ├── property.json
        │
        └── <paddock-id>/
            └── index.html
