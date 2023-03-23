<script lang="ts">
    export let btnClass: string = "";
    export let disabled: boolean = false;
</script>

<button
    type="button"
    on:click
    on:mouseover
    on:focus
    {disabled}
    class="text-center font-medium inline-flex items-center justify-center px-5 py-2.5 text-sm text-white rounded-lg
        bg-device-color1
        focus:ring-4 focus:outline-none focus:ring-purple-300
        hover:bg-device-color1/[.7] {btnClass}"
>
    <slot />
</button>
