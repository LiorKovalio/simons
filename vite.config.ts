import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		__APP_ENV__: process.env.VITE_VERCEL_ENV,
	},
});
