<script lang="ts">
    export let text: string;
    export let checked: boolean;
    export let disabled: boolean;
</script>

<label class="relative inline-flex items-center cursor-pointer">
    <input
        type="checkbox"
        value=""
        class="sr-only peer"
        bind:checked
        {disabled}
    />
    <div
        class="w-11 h-6 bg-device-color1/[.7] rounded-full peer dark:bg-gray-700
        peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:content-['✓']
        after:content-['🞫'] after:absolute after:top-0.5 after:left-[2px] after:bg-white
        after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:text-center after:leading-4
        after:text-device-color1
        after:transition-all dark:border-gray-600 peer-checked:bg-device-color1
        peer-disabled:bg-gray-200 peer-disabled:after:text-gray-200"
    />
    <span class="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300"
        >{text}</span
    >
</label>
