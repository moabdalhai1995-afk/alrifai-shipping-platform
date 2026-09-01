# Al-Rifai Production Stable

This repository uses `main` as the production release branch.

## Release gate

Every push to `main` must pass the platform validation command (`npm run check`) before the signed Android APK/AAB is built or published. A failed validation blocks publication from that workflow run.

## Stable release scope

The stable release includes the current customer, admin, accounting, shipping, tracking, products, cars showroom, image upload, authentication, notification, warehouse, Sudan fulfillment and Android application features.

## Authentication baseline

- Customer sign-in uses phone number and password.
- Email is retained for account recovery.
- Saudi phone formats and supported international formats are normalized for compatibility.
- Admin and vehicle-agent authorization remain role restricted.

## Deployment principle

Production updates must preserve existing public routes and stored data unless an explicit migration is required. HTML pages are revalidated so deployed fixes can appear without requiring customers to clear application data.

## Status

`v3.14.0` is designated as the first Production Stable baseline. This designation means the automated validation and signed-build gates pass; it does not claim that software can never encounter a future defect.
