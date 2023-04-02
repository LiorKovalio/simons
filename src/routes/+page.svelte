<!-- https://github.com/anchetaWern/RNMemory/blob/master/app/screens/Game.js -->
<script lang="ts">
    import { onMount } from "svelte";

    import { useMachine } from "@xstate/svelte";

    import Pusher from "pusher-js";
    import * as PusherTypes from "pusher-js";

    import {
        States,
        Events,
        simonMachine,
        SimonModes,
    } from "../lib/simonLogic";
    import { sleep } from "../lib/sleep";

    /** @type {import('./$types').LayoutData} */
    export let data;

    const {
        state: simonState,
        send: simonSend,
        service: simonService,
    } = useMachine(simonMachine);
    simonService
        .onTransition(async (state) => {
            console.log(
                `${state.value}\n\tsequence: ${state.context.sequence}\n\tcurrent: ${state.context.currentSequence}`
            );
            console.log(`\tmode: ${state.context.mode}`);
            switch (state.value) {
                case States.WaitingForUser:
                    if (
                        state.context.sequence.length > 0 &&
                        state.context.currentSequence.length === 0
                    ) {
                        await withUserInputDisabled(async () => {
                            allActive = true;
                            await sleep(show_press_gap);
                            allActive = false;
                            await sleep(show_press_gap);
                            await playSequence(state.context.sequence);
                        });
                    }
                    break;
                case States.WaitingForOpponent:
                    disabled = true;
                    break;
                // case States.Win:
                //     closeConnection();
                //     break;
                // case States.Fail:
                //     if (state.context.mode === SimonModes.Duel) {
                //         closeConnection();
                //     }
                //     break;
                default:
                    break;
            }
        })
        .onEvent((event) => {
            console.dir(event);
            switch (event.type) {
                case Events.Click:
                    if (
                        $simonState.context.mode === SimonModes.Duel &&
                        pusher_private_user_channel != null
                    ) {
                        const e = event as { type: Events.Click; opt: string };
                        if (
                            $simonState.value === States.WaitingForUser ||
                            $simonState.value === States.WaitingForExtension
                        ) {
                            pusher_private_user_channel.trigger(
                                "client-ioclicked",
                                {
                                    opt: e.opt,
                                }
                            );
                        }
                    }
                    break;
                // case Events.SetMode:
                //     const e = event as {
                //         type: Events.SetMode;
                //         mode: SimonModes;
                //     };
                //     toggleConnection(e.mode);
                //     break;
            }
        })
        .start();

    let sfxs = ["a4", "c4", "e4", "g4"];
    let notes = [440, 261, 329, 392];
    let show_press_duraion = 500;
    let show_press_gap = 500;

    let disabled = true;
    let allActive = false;
    let colorActive = "";
    let duel_status: "off" | "subscribed" | "playing" = "off";
    let input_username = "";
    let paired_players: string[] = [];

    let step = 1;
    $: simonSend({ type: Events.SetStep, step: step });

    // audio vars, inited on onMount. see "onMount audioContext"
    let oscillator: OscillatorNode | null;
    let gainNode: GainNode | null;
    let audioContextInited = false;
    let initAudioContext = () => {
        audioContextInited = true;
    };

    // pusher connection vars
    let pusher: Pusher | null = null;
    let pusher_private_user_channel: PusherTypes.Channel | null = null;
    let other_subscriptions: string[] = [];
    function onPusherSubscriptionError(status) {
        console.error(
            "Error",
            "Subscription error occurred. Please restart the app"
        );
    }

    function maybePair(
        username: string,
        event_name: string,
        data: { players: string[] }
    ): boolean {
        if (
            $simonState.value === States.Off ||
            $simonState.value === States.Fail ||
            $simonState.value === States.Win
        ) {
            duel_status = "playing";
            forceHideStartButton = false;
            console.log(`got event "${event_name}" with data: ${data}`);
            if ("players" in data && data.players.length > 0) {
                const myTurn = data.players[0] === username;
                console.log("myTurn?", myTurn);
                disabled = !myTurn;

                paired_players = data.players;
                data.players.forEach((p: string) => {
                    if (p !== username) {
                        console.log(username, "working with", p);
                        setTransportToOther(p, data.players);
                    }
                });

                simonSend({
                    type: Events.Start,
                    myTurn: myTurn,
                });
                return true;
            } else {
                console.error("bad data. missing players");
            }
        } else {
            console.error("not waiting for pairing");
        }
        return false;
    }

    function setTransportToOther(p: string, players: string[]) {
        const channel_name = `private-user-${p}`;
        other_subscriptions.push(channel_name);
        const pc = pusher!.subscribe(channel_name);
        pc.bind("pusher:subscription_error", onPusherSubscriptionError);

        pc.bind("pusher:subscription_succeeded", (data) => {
            console.log("opponent subscription ok: ", data);

            pc.trigger("client-paired", { players: players });

            pc.bind("client-ioclicked", (data) => {
                if ($simonState.value === States.WaitingForOpponent) {
                    console.log(`opponent clicked : "${data.opt}"`);
                    simonSend({
                        type: Events.Click,
                        opt: data.opt,
                    });
                } else {
                    console.error("not expecting opponent play");
                }
            });
        });
    }

    let setPusherConnection = () => {};
    function closeConnection() {
        if (pusher != null) {
            other_subscriptions.forEach((name) => pusher!.unsubscribe(name));
            other_subscriptions = [];
            pusher.disconnect();
            pusher = null;
        }
    }

    onMount(async () => {
        console.log("import meta env MODE", import.meta.env.MODE);

        setPusherConnection = () => {
            const username =
                input_username === "" ? Date.now().toString() : input_username;
            console.log("username is", username);

            if (username) {
                console.log("connecting");
                // connect to Pusher:
                pusher = new Pusher(data.APP_KEY, {
                    cluster: data.APP_CLUSTER,
                    channelAuthorization: {
                        endpoint: "/api/pusher/auth",
                        params: { username: username },
                        transport: "ajax",
                    },
                });
                console.log("pusher created");

                pusher_private_user_channel = pusher.subscribe(
                    `private-user-${username}`
                ); // subscribe to user's unique channel

                // subscription error occurred
                pusher_private_user_channel.bind(
                    "pusher:subscription_error",
                    onPusherSubscriptionError
                );

                // subscription to their own channel succeeded
                pusher_private_user_channel.bind(
                    "pusher:subscription_succeeded",
                    (data) => {
                        console.log("subscription ok: ", data);
                        duel_status = "subscribed";

                        pusher_private_user_channel!.bind(
                            "waiting_for_opponent",
                            (data) => {
                                console.log("waiting for opponent", data);
                            }
                        );

                        pusher_private_user_channel!.bind(
                            "paired",
                            (data: { players: string[] }) => {
                                maybePair(username, "paired", data);
                            }
                        );

                        pusher_private_user_channel!.bind(
                            "client-paired",
                            (data: { players: string[] }) => {
                                maybePair(username, "client_paired", data);
                            }
                        );
                    }
                );
            }
        };

        // onMount audioContext
        initAudioContext = () => {
            if (!audioContextInited) {
                const AudioContext =
                    window.AudioContext || window.webkitAudioContext;
                const audioCtx = new AudioContext();
                console.log(audioCtx);

                // create Oscillator and gain node
                oscillator = audioCtx.createOscillator();
                gainNode = audioCtx.createGain();

                // connect oscillator to gain node to speakers
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                oscillator.start(0);

                oscillator.frequency.value = 420;
                gainNode.gain.value = 0;
                oscillator.detune.value = 0;

                oscillator.onended = function () {
                    console.log("Your tone has now stopped playing!");
                };

                audioContextInited = true;
            }
        };
    });

    async function playSequence(sequence: string[]) {
        for (const color of sequence) {
            await lightPad(color);
        }
    }

    async function withUserInputDisabled(func: () => void) {
        disabled = true;
        const res = await func();
        disabled = false;
        return res;
    }

    let forceHideStartButton = false;
    async function startGame() {
        if (!audioContextInited) {
            initAudioContext();
        }

        if ($simonState.context.mode === SimonModes.Solo) {
            withUserInputDisabled(async () => {
                simonService.send(Events.Start);
            });
        } else if ($simonState.context.mode === SimonModes.Duel) {
            setPusherConnection();
            forceHideStartButton = true;
        }
    }

    async function repeat() {
        withUserInputDisabled(async () => {
            await sleep(show_press_gap);
            await playSequence($simonState.context.sequence);
        });
    }

    function isSameSeq(a1: any[], a2: any[]): boolean {
        return (
            a1.length === a2.length &&
            a1.every((element, index) => element === a2[index])
        );
    }

    function playNote(frequency: number, volume: number) {
        if (oscillator && gainNode) {
            oscillator.frequency.value = frequency;
            gainNode.gain.value = volume;
        }
    }

    function stopNote() {
        if (gainNode) {
            gainNode.gain.value = 0;
        }
    }

    async function lightPad(color: string) {
        // activateSfx(opts.indexOf(color));
        playNote(notes[$simonState.context.opts.indexOf(color)], 0.4);
        colorActive = color;
        await sleep(show_press_duraion);
        colorActive = "";
        stopNote();
        await sleep(show_press_gap);
    }

    let is_sfx_active = false;
    let sfxsBinds: Array<HTMLAudioElement | null> = sfxs.map((_) => null);
    const activateSfx = (i: number) => {
        if (i < sfxsBinds.length && sfxsBinds[i]) {
            is_sfx_active = !is_sfx_active;
            sfxsBinds[i]!.play();

            setTimeout(() => {
                is_sfx_active = false;
                sfxsBinds[i]!.pause();
                sfxsBinds[i]!.currentTime = 0;
            }, show_press_duraion);
        }
    };
    // src="https://www.myinstants.com/media/sounds/m4a1_single-kibblesbob-8540445.mp3"

    // function handleGameModeClick() {
    //     if ($simonState.context.mode === SimonModes.Solo) {
    //         simonSend({ type: Events.SetMode, mode: SimonModes.Duel });
    //     } else if ($simonState.context.mode === SimonModes.Duel) {
    //         forceHideStartButton = false;
    //         closeConnection();
    //         simonSend({ type: Events.SetMode, mode: SimonModes.Solo });
    //     }
    // }

    let isDaily = false;
    async function setGameMode(mode: SimonModes | "daily") {
        isDaily = false;
        switch (mode) {
            case SimonModes.Solo:
                forceHideStartButton = false;
                closeConnection();
                simonSend({ type: Events.SetMode, mode: SimonModes.Solo });
                simonSend({ type: Events.SetSequence, sequence: [] });
                break;
            case SimonModes.Duel:
                simonSend({ type: Events.SetMode, mode: SimonModes.Duel });
                simonSend({ type: Events.SetSequence, sequence: [] });
                step = 1;
                simonSend({ type: Events.SetStep, step: step });
                break;
            case "daily":
                console.debug("daily");
                await setGameMode(SimonModes.Solo);
                isDaily = true;
                simonSend({
                    type: Events.SetSequence,
                    sequence: await fetchDailySequence(),
                });
                break;
        }
    }

    async function fetchDailySequence() {
        let body = { opts: $simonState.context.opts, size: 10 };
        let sequence: string[] = await fetch("/api/daily", {
            method: "POST",
            body: JSON.stringify(body),
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Network response was not OK");
                }
                return response.json();
            })
            .then((data) => {
                if (data.warnings && data.warnings.length > 0) {
                    console.warn({ fetch: { sent: body, warn: data.warnings } });
                }
                console.log({ fetch: { sent: body, got: data } });
                return data.sequence;
            });
        return sequence;
    }

    import ArcButton from "../lib/ArcButton.svelte";
    const degs = [270, 0, 180, 90];
    const border_color = "#c4bebb";
    const device_size = "60vmin";
    const optProps = {
        red: {
            color: "#E52521",
            active: "#ff462b",
        },
        green: {
            color: "#43B047",
            active: "#00f36f",
        },
        yellow: {
            color: "#FBD000",
            active: "#ffe41e",
        },
        blue: {
            color: "#049CD8",
            active: "#00a4fb",
        },
    };

    import SettingsButton from "../lib/SettingsButton.svelte";

    // settings drawer
    // flowbite drawer
    // https://flowbite-svelte.com/components/drawer
    import { Drawer, CloseButton } from "flowbite-svelte";
    import { sineIn } from "svelte/easing";
    import CircleProgressBar from "$lib/CircleProgressBar.svelte";
    import { scale } from "svelte/transition";

    let hidden1 = true;
    let transitionParamsTop = {
        y: -320,
        duration: 200,
        easing: sineIn,
    };
    $: progress =
        $simonState.context.currentSequence.length /
        ($simonState.context.sequence.length +
            ($simonState.context.mode === SimonModes.Duel ? 1 : 0));
    $: progress_ring_color = $simonState.context.sequence.length === $simonState.context.currentSequence.length ? "black" : "gainsboro";
</script>

<!-- https://codesandbox.io/s/nmdi4 -->

{#each sfxs as s, i}
    <audio src="audio/{s}.mp3" preload="auto" bind:this={sfxsBinds[i]}>
        <track kind="captions" />
    </audio>
{/each}

<Drawer
    transitionType="fly"
    transitionParams={transitionParamsTop}
    bind:hidden={hidden1}
    id="sidebar1"
    placement="top"
    width="w-full"
>
    <div class="flex items-center">
        <CloseButton
            on:click={() => (hidden1 = true)}
            class="mb-4 dark:text-white"
        />
    </div>
    <div class="flex flex-col items-center space-y-1">
        <div class="flex flex-row space-x-1" id="gameModeSelector">
            <SettingsButton
                btnClass={!isDaily &&
                $simonState.context.mode === SimonModes.Solo
                    ? "selectedGameMode"
                    : "baseGameMode"}
                on:click={() => setGameMode(SimonModes.Solo)}
                disabled={!$simonState.can({
                    type: Events.SetMode,
                    mode: SimonModes.Solo,
                })}
            >
                Regular
            </SettingsButton>
            <SettingsButton
                btnClass={isDaily ? "selectedGameMode" : "baseGameMode"}
                on:click={() => setGameMode("daily")}
                disabled={!$simonState.can({
                    type: Events.SetMode,
                    mode: SimonModes.Solo,
                })}
            >
                Daily 10
            </SettingsButton>
            <SettingsButton
                btnClass={!isDaily &&
                $simonState.context.mode === SimonModes.Duel
                    ? "selectedGameMode"
                    : "baseGameMode"}
                on:click={() => setGameMode(SimonModes.Duel)}
                disabled={!$simonState.can({
                    type: Events.SetMode,
                    mode: SimonModes.Duel,
                })}
            >
                Duel
            </SettingsButton>
        </div>

        {#if $simonState.context.mode === SimonModes.Solo}
            <p>
                <label for="settingsStepSize">Step:</label>
                <input
                    id="settingsStepSize"
                    type="number"
                    placeholder="step:"
                    min="1"
                    bind:value={step}
                />
            </p>
        {/if}

        <SettingsButton
            on:click={() => {
                hidden1 = true;
                repeat();
            }}
            disabled={disabled ||
                !(
                    ($simonState.value === States.WaitingForUser &&
                        $simonState.context.currentSequence.length === 0) ||
                    $simonState.value === States.Fail ||
                    $simonState.value === States.Win
                )}
        >
            repeat
        </SettingsButton>
        {#if $simonState.context.mode === SimonModes.Duel}
            <br />
            <input
                type="text"
                bind:value={input_username}
                placeholder="username:"
            />
            <br />
            <pre>
    duel_status: {duel_status}
    input_username: {input_username}
    players: {paired_players}

    simonState: {$simonState.value}
    mode: {$simonState.context.mode}</pre>
        {/if}
    </div>
</Drawer>

<header class="flex flex-col items-center my-6">
    <SettingsButton on:click={() => (hidden1 = false)}>
        <svg
            xmlns="http://www.w3.org/2000/svg"
            height="28"
            viewBox="4 4 24 24"
            width="28"
            class="game-icon"
            data-testid="icon-settings"
        >
            <path
                fill="white"
                d="M25.52 17.2534C25.5733 16.8534 25.6 16.44 25.6 16C25.6 15.5734 25.5733 15.1467 25.5067 14.7467L28.2133 12.64C28.4533 12.4534 28.52 12.0934 28.3733 11.8267L25.8133 7.40004C25.6533 7.10671 25.32 7.01338 25.0267 7.10671L21.84 8.38671C21.1733 7.88004 20.4667 7.45338 19.68 7.13338L19.2 3.74671C19.1467 3.42671 18.88 3.20004 18.56 3.20004H13.44C13.12 3.20004 12.8666 3.42671 12.8133 3.74671L12.3333 7.13338C11.5467 7.45338 10.8267 7.89338 10.1733 8.38671L6.98665 7.10671C6.69332 7.00004 6.35998 7.10671 6.19998 7.40004L3.65332 11.8267C3.49332 12.1067 3.54665 12.4534 3.81332 12.64L6.51998 14.7467C6.45332 15.1467 6.39998 15.5867 6.39998 16C6.39998 16.4134 6.42665 16.8534 6.49332 17.2534L3.78665 19.36C3.54665 19.5467 3.47998 19.9067 3.62665 20.1734L6.18665 24.6C6.34665 24.8934 6.67998 24.9867 6.97332 24.8934L10.16 23.6134C10.8267 24.12 11.5333 24.5467 12.32 24.8667L12.8 28.2534C12.8667 28.5734 13.12 28.8 13.44 28.8H18.56C18.88 28.8 19.1467 28.5734 19.1867 28.2534L19.6667 24.8667C20.4533 24.5467 21.1733 24.12 21.8267 23.6134L25.0133 24.8934C25.3067 25 25.64 24.8934 25.8 24.6L28.36 20.1734C28.52 19.88 28.4533 19.5467 28.2 19.36L25.52 17.2534ZM16 20.8C13.36 20.8 11.2 18.64 11.2 16C11.2 13.36 13.36 11.2 16 11.2C18.64 11.2 20.8 13.36 20.8 16C20.8 18.64 18.64 20.8 16 20.8Z"
            />
        </svg>
    </SettingsButton>
    {#if !import.meta.env.PROD}
        <pre>
simonState: {$simonState.value}
mode: {$simonState.context.mode}
sequence: {$simonState.context.sequence}
current: {$simonState.context.currentSequence}</pre>
    {/if}
</header>

<section
    style:--borders-color={border_color}
    style:--device-size={device_size}
    style:--pad_size="calc({device_size}/2)"
    class:my-6={!import.meta.env.PROD}
>
    <div
        id="circle"
        class="circle"
        style:display="block"
        style:outline="50px solid var(--borders-color)"
    >
        {#each $simonState.context.opts as color, i}
            {@const { color: fgcolor, active: activecolor } = optProps[color]}
            <ArcButton
                {fgcolor}
                bgcolor={border_color}
                {activecolor}
                size="var(--pad_size)"
                radius="310px"
                rotation="{degs[i]}deg"
                active={colorActive === color || allActive}
                bind:disabled
                on:click={async () => {
                    await lightPad(color);
                    simonSend({ type: Events.Click, opt: color });
                }}
            />
        {/each}

        <div class="center">
            <div class="transition-container">
                {#if !forceHideStartButton && ($simonState.value === States.Off || $simonState.value === States.Fail || $simonState.value === States.Win)}
                    <button
                        class="start text-base"
                        on:click={startGame}
                        transition:scale>Simon</button
                    >
                {:else}
                    <div transition:scale>
                        <CircleProgressBar
                            color="var(--device-color1)"
                            ringcolor={progress_ring_color}
                            width="calc(var(--pad_size) / 2)"
                            bind:progress
                        />
                    </div>
                {/if}
            </div>
        </div>
    </div>
</section>

<style>
    :global(:root) {
        --device-color1: #9a2257;
    }

    * {
        box-sizing: border-box;
        user-select: none;
    }

    #gameModeSelector > :global(:first-child) {
        border-radius: 0.5rem 0 0 0.5rem;
    }

    #gameModeSelector > :global(:not(:first-child):not(:last-child)) {
        border-radius: 0;
    }

    :global(.baseGameMode) {
        opacity: 50%;
    }
    :global(.selectedGameMode) {
        opacity: 100%;
    }

    #gameModeSelector > :global(:last-child) {
        border-radius: 0 0.5rem 0.5rem 0;
    }

    section {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }
    .circle {
        font-size: 7vmin;
        height: var(--device-size);
        width: var(--device-size);
        background-color: var(--borders-color);
        border-radius: 50%;
        position: relative;
    }

    .start {
        cursor: pointer;
        background-color: var(--device-color1);
        color: white;
        border-radius: 50%;
        width: calc(var(--pad_size) / 2);
        aspect-ratio: 1;
        border: none;
    }

    .center {
        color: white;
        background-color: var(--borders-color);
        content: "";
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        height: 50%;
        width: 50%;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
    }

    /*
        Make items that share space transition well
        https://imfeld.dev/writing/svelte_overlapping_transitions
    */
    .transition-container {
        display: grid;
        grid-template-rows: 1fr;
        grid-template-columns: 1fr;
    }

    .transition-container > * {
        grid-row: 1;
        grid-column: 1;
    }
</style>
