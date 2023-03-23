<script lang="ts">
    export let size: string;
    export let radius: string;
    export let fgcolor: string = "black";
    export let bgcolor: string = "black";
    export let activecolor: string = "black";
    export let rotation: string = "0deg";
    export let active: boolean = false;
    export let disabled: boolean = false;
    $: popdir = parseInt(rotation.slice(0, rotation.length - 3)) + 45 + "deg";
</script>

<button
    type="button"
    style:--size={size}
    style:--radius={radius}
    style:--color={fgcolor}
    style:--aftercolor={bgcolor}
    style:--activecolor={activecolor}
    style:--rotation={rotation}
    style:--popdir={popdir}
    style:transform="rotate({rotation}) scale(95%)"
    class:active
    {disabled}
    on:click
    on:mouseover
    on:focus
/>

<style>
    button {
        border: none;
        position: relative;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent; /* removes blue selection box on touch devices */
        transition: top, left, background-color 100ms linear;
        top: 0;
        left: 0;
        width: var(--size);
        height: var(--size);
        border-radius: 0 var(--radius) 0 0;
        background-color: var(--color);
    }

    button::after {
        content: "";
        display: block;
        position: absolute;
        left: -1px;
        bottom: -1px;
        cursor: auto;
        width: calc(var(--size) / 2);
        height: calc(var(--size) / 2);
        border-radius: 0 var(--radius) 0 0;
        background-color: var(--aftercolor);
    }

    button:disabled {
        pointer-events: none;
    }

    button.active {
        background-color: var(--activecolor);
        top: calc(-25px * cos(var(--popdir)));
        left: calc(25px * sin(var(--popdir)));
    }

    @media (hover: hover) and (pointer: fine) { /* no hover on touch devices. meaning no sticky color change after click */
        button:hover {
            background-color: var(--activecolor);
        }
    }
</style>
