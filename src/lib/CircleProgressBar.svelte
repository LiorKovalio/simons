<!-- https://svelte.dev/repl/f1437286b08d4890b9207180868ee37e?version=3.58.0 -->
<script lang="ts">
	export let width: string;
	export let color: string;
	export let ringcolor: string;
	export let progress: number;
	$: angle = 360 * progress;
	$: background = `
		radial-gradient(${color} 50%, transparent 51%),
		conic-gradient(transparent 0deg ${angle}deg, ${ringcolor} ${angle}deg 360deg)
		`;
</script>

<style>
#progress-circle {
	border-radius: 50%;
	aspect-ratio: 1;
	transition: all 500ms ease-in;
	will-change: transform;
}
</style>

<div id="progress-circle" style:background style:width></div>
