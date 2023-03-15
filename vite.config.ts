import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		VITE_VERCEL_ENV: process.env.VITE_VERCEL_ENV,
	},
});
