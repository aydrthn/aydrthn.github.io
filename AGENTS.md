## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Project Goal

This is a personal website built with Astro and intended to be deployed at `aydrthn.github.io`.

## Requirements

- Keep the overall design clean, modern, polished, and subtly Apple-inspired
- Avoid overly flashy or decorative design
- Support light and dark modes
- Provide a good responsive experience across desktop and mobile
- Prefer Astro, semantic HTML, native CSS, and minimal JavaScript
- Do not introduce React, Vue, Tailwind, or large UI/animation libraries unless clearly necessary
- Keep dependencies minimal and the codebase easy to maintain
- Preserve accessibility, semantic structure, and basic SEO
- Keep animations subtle, natural, and performance-friendly
- Glass, blur, translucency, and similar effects may be used selectively, but should not be overused
- Use English only

## Site Structure

The website should primarily contain:

- Home
- About
- Projects
- Experience

Prefer reusable layouts and components where appropriate.

## Workflow

Before making large changes:

1. Inspect the existing codebase and relevant Astro documentation
2. Briefly explain the proposed implementation approach
3. Reuse the existing structure where possible and avoid unnecessary refactoring

After making changes:

- Verify that the site works correctly
- Run the production build and fix any errors
- Do not modify unrelated files