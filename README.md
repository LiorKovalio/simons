# create-svelte

Everything you need to build a Svelte project, powered by [`create-svelte`](https://github.com/sveltejs/kit/tree/master/packages/create-svelte).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```bash
# create a new project in the current directory
npm create svelte@latest

# create a new project in my-app
npm create svelte@latest my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://kit.svelte.dev/docs/adapters) for your target environment.


## Simons
* Play all-time favorite game Simon
* Duel play, where the added item is chosen by an opponent

### TODO
* add sfx for correct pattern, and for failure
* fix focus on last pad clicked on mobile (force drop focus)
* refactore out websockets (unsupported on vercel) in favor of an API (ably? pusher?). note open issues with socketio
    * fix ENDPOINT to support both network, localhost and machine
    * handle disconnect (midgame)
    * add option to set a name on connection
        * allow pairing to a name
    * API options:
        * pusher
        * ably

### Dreams
* harder (after some condition):
    * add pads
    * use larger extensions (add 2 clicks each time)
* more players (more than 2, maybe it's fun)
* pc player
* export sequence (say it's a nice tune)
* sequence of the day - daily memory exrecise
