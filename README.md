# NYC Transportation & Safety Planner MVP

A minimal React + Vite web app that helps NYC transportation and safety planners identify high-risk crash locations using the NYC Motor Vehicle Collisions API.

## What it does

- Fetches crash data from the NYC collisions open data API
- Cleans and validates records before analysis
- Groups crashes by location and borough
- Scores locations using crash frequency plus injury/fatality severity
- Displays results on an interactive NYC map and priority list
- Supports date range, borough, and severity filters
- Shows loading, empty, and error states clearly

## Key features

- Prioritization score based on both crash frequency and severity
- Location-level insights for planners, not just raw records
- Interactive map markers and location detail panel
- Deploy-safe fix: build tooling is available in dependencies so `npm run build` works when dev dependencies are omitted

## Install

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Open the app in your browser at the URL shown by Vite.

## Build for production

```bash
npm run build
```

## Project structure

- `src/App.tsx` — main dashboard and state management
- `src/dataApi.ts` — API fetch logic and response cleanup
- `src/dataProcessing.ts` — location grouping and prioritization scoring
- `src/MapView.tsx` — interactive Leaflet map view
- `src/FiltersPanel.tsx` — user filters for date, borough, and severity
- `src/LocationDetails.tsx` — selected location detail panel
- `src/styles.css` — app styling

## Notes

- The app fetches a limited number of records to keep the MVP performant.
- Missing borough or coordinates are treated as unusable for location-level mapping.
- The prioritization score is an MVP scoring method and not an official safety rating.

## Deployment

This repository was configured so that build tooling is available in `dependencies`, which helps avoid deployment failures when production installs omit dev dependencies.
