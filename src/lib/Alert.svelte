<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { fade, fly } from "svelte/transition";

    export let hidden = true;
    export let title: string | null = null;
    export let msg: string | null = null;
    export let type: "info" | "warning" | "error" = "info";
    export let timeout: number | null = 4000;
    const dispatch = createEventDispatcher();

    let divCls: string,
        titleCls: string,
        msgCls: string,
        closeButtonCls: string,
        closeSvgCls: string;
    $: switch (type) {
        case "info":
            divCls = "bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative";
            titleCls = "font-bold";
            msgCls = "block sm:inline";
            closeButtonCls = "absolute top-0 bottom-0 right-0 px-4 py-3";
            closeSvgCls = "fill-current h-6 w-6 text-green-500";
            break;
        case "warning":
            divCls = "bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative";
            titleCls = "font-bold";
            msgCls = "block sm:inline";
            closeButtonCls = "absolute top-0 bottom-0 right-0 px-4 py-3";
            closeSvgCls = "fill-current h-6 w-6 text-yellow-500";
            break;
        case "error":
            divCls = "bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative";
            titleCls = "font-bold";
            msgCls = "block sm:inline";
            closeButtonCls = "absolute top-0 bottom-0 right-0 px-4 py-3";
            closeSvgCls = "fill-current h-6 w-6 text-red-500";
            break;
    }

    let timeout_id: ReturnType<typeof setTimeout> | null = null;
    function setTimer(hidden: boolean) {
        if (hidden) {
            if (timeout_id != null) {
                clearTimeout(timeout_id);
                timeout_id = null;
            }
        } else if (timeout != null && timeout > 0) {
            if (timeout_id != null) {
                clearTimeout(timeout_id);
                timeout_id = null;
            }
            timeout_id = setTimeout(() => {
                dispatch("hide");
                timeout_id = null;
            }, timeout);
        } else {
            timeout_id = null;
        }
    }
    $: setTimer(hidden);
</script>

{#if !hidden}
    <div
        class={divCls}
        role="alert"
        in:fly={{ y: 200, duration: 1000 }}
        out:fade
    >
        {#if title}
            <strong class={titleCls}>{title}</strong>
        {/if}
        {#if msg}
            <span class={msgCls}>{msg}</span>
        {/if}
        <button type="button" class={closeButtonCls} on:click>
            <svg
                class={closeSvgCls}
                role="button"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
            >
                <title>Close</title>
                <path
                    d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"
                />
            </svg>
        </button>
    </div>
{/if}

<style>
    div {
        position: fixed;
        width: 30dvw;
        margin-left: -15dvw;
        left: 50%;
        top: 50%;
    }
</style>
