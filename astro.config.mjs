// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://aydrthn.github.io',
  output: 'static',
  trailingSlash: 'always',
  image: {
    layout: 'constrained',
    responsiveStyles: true,
  },
});
