# Local Server Manual

## Open the project

Run all commands below from the project directory:

```sh
cd /Users/anderson/Documents/GitHub/aydrthn.github.io
```

The project requires Node.js 22.12.0 or newer and npm. Check your versions:

```sh
node --version
npm --version
```

On a fresh checkout, install the dependencies from the lockfile:

```sh
npm ci
```

## Start the development server

```sh
npm run dev -- --background
```

Open the local URL reported by Astro, normally <http://localhost:4321/>. Use the actual reported port if 4321 is occupied.

The server runs in the background and reloads the browser when source files change. Closing the terminal or browser does not stop it. Per `AGENTS.md`, always start the development server in background mode.

## Check status and logs

```sh
npm run dev -- status
npm run dev -- logs
```

To stream new log messages:

```sh
npm run dev -- logs --follow
```

Press `Ctrl+C` to exit the log stream. This leaves the background server running.

## Stop or restart the server

Stop the background server and confirm its status:

```sh
npm run dev -- stop
npm run dev -- status
```

To restart it, run the stop command first, then:

```sh
npm run dev -- --background
```

## Troubleshooting

- **The page does not open:** check `status` and `logs`, then open the URL reported by Astro. Start the server if no server is running.
- **The port is occupied:** stop this project's server if it is already running, or choose another port:

  ```sh
  npm run dev -- --background --port 4322
  ```

  Open the URL reported by Astro, normally <http://localhost:4322/> for this command.
- **Dependencies are missing:** run `npm ci`, then start the server again.
- **Changes do not appear:** confirm that the browser uses the current server URL, reload the page, and inspect the logs. Restart the server after changing dependencies or if it reports a restart is required.

## Verify the production build

```sh
npm run build
```

This generates the static site in `dist/`. Starting a local server or building the site does not publish changes to GitHub Pages.

## Command reference

The `dev` script in `package.json` runs the project's installed `astro dev`. The `--` after `npm run dev` forwards the remaining arguments to Astro; no global Astro installation is needed.

| Action | Command |
| --- | --- |
| Start in background | `npm run dev -- --background` |
| Check status | `npm run dev -- status` |
| Read logs | `npm run dev -- logs` |
| Follow logs | `npm run dev -- logs --follow` |
| Stop | `npm run dev -- stop` |
| Build | `npm run build` |

References: [project instructions](AGENTS.md), [Astro CLI documentation](https://docs.astro.build/en/reference/cli-reference/).
