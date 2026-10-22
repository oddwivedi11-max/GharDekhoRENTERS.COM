# GharDekho Renters

GharDekho Renters is a static website backed by Supabase. The main public app is `index.html`; the Monster Hunter page and policy/contact pages are separate HTML files.

## Local development

1. Clone the repository.
2. Open the project folder in VS Code.
3. Serve the folder with a local static server (for example, VS Code Live Server or `npx serve .`).
4. Open the local URL in a browser and inspect the console/network panel.
5. Do not place service-role keys or passwords in the repository. The browser should use only the Supabase publishable key.

## QA

- Test renter, owner, public visitor and admin routes separately.
- Use only synthetic `ZZ-TEST` accounts and listings in an isolated QA database.
- Do not seed fake properties into production.
- Run the inline-script syntax check and browser workflow tests before proposing a release.
- Record confirmed issues, evidence, fixes and regression results in `docs/WORKLOG.md`.

## Deployment

Production deployment is configured in `.github/workflows/deploy-cloudflare.yml` and uses GitHub Actions secrets for the Cloudflare API token and account ID. The workflow is triggered by pushes to `main` or manually.

A second GitHub Pages workflow exists. Verify which deployment actually serves the custom domain before changing either workflow. Do not merge to `main`, apply production database migrations, or deploy without explicit owner approval.

## Database

The Supabase schema and policies are not fully represented by the repository migrations. Inspect current production definitions read-only first. Prepare database changes as migrations and obtain approval before applying them to production.
