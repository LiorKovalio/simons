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
    export let data = {} as { APP_CLUSTER: string; APP_KEY: string };

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
                case States.Win:
                case States.Fail:
                    if (state.value === States.Win) {
                        onWin();
                    } else {
                        onFail();
                    }
                    disabled = true;
                    if (pusher_private_user_channel != null) {
                        console.log("trigger", "client-ioendgame", {
                            state: state.value,
                            sequence: state.context.sequence,
                            currentSequence: state.context.currentSequence,
                        });
                        pusher_private_user_channel.trigger(
                            "client-ioendgame",
                            {
                                state: state.value,
                                sequence: state.context.sequence,
                                currentSequence: state.context.currentSequence,
                            }
                        );
                    }
                    alert_data = {
                        title: state.value,
                        msg: null,
                        type: "info",
                    };
                    unsubscribe();
                    unsubscribe_me();

                    if (isDaily != null) {
                        setGameMode(SimonModes.Solo);
                    }
                    forceHideStartButton = false;
                    break;
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
    $: is_game_off =
        $simonState.value === States.Off ||
        $simonState.value === States.Fail ||
        $simonState.value === States.Win;

    let notes = [440, 261, 329, 392];
    let show_press_duration = 500;
    let show_press_gap = 500;

    let disabled = true;
    let allActive = false;
    let colorActive = "";
    let input_username = "";
    let paired_players: string[] = [];

    const STEP_MIN = 1;
    const STEP_MAX = 10;
    let step = STEP_MIN;
    $: step = Math.min(Math.max(step, STEP_MIN), STEP_MAX);
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
        alert_data = {
            title: "Error",
            msg: "Subscription error occurred. Please reload the page",
            type: "error",
        };
    }

    function maybePair(
        username: string,
        event_name: string,
        data: { players: string[] }
    ): boolean {
        if (is_game_off) {
            forceHideStartButton = false;
            console.log(`got event "${event_name}" with data:`, data);
            if ("players" in data && data.players.length > 1) {
                const myTurn = data.players[0] === username;
                console.log("myTurn?", myTurn);
                disabled = !myTurn;

                paired_players = data.players;
                data.players.forEach((p: string) => {
                    if (p !== username) {
                        console.log(username, "working with", p);
                        alert_data = {
                            title: "Pairing",
                            msg: p,
                            type: "info",
                        };
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
            alert_data = {
                title: "Paired",
                msg: pc.name,
                type: "info",
            };

            pc.trigger("client-paired", { players: players });

            pc.bind("client-ioclicked", (data) => {
                if ($simonState.value === States.WaitingForOpponent) {
                    console.log(`opponent (${p}) clicked : "${data.opt}"`);
                    simonSend({
                        type: Events.Click,
                        opt: data.opt,
                    });
                } else {
                    console.error(`not expecting opponent (${p}) play`);
                }
            });

            pc.bind("client-ioendgame", (data) => {
                console.log(`opponent (${p}) endgame:`, data);
                unsubscribe();
                unsubscribe_me();
                forceHideStartButton = false;
            });
        });
    }

    let setPusherConnection: () => string | null = () => {
        return null;
    };

    function unsubscribe() {
        other_subscriptions.forEach((name) => pusher?.unsubscribe(name));
        other_subscriptions = [];
        paired_players = [];
    }

    function unsubscribe_me() {
        if (pusher !== null && pusher_private_user_channel !== null) {
            pusher.unsubscribe(pusher_private_user_channel.name);
            pusher_private_user_channel = null;
            is_connected = false;
        }
    }

    function closeConnection() {
        if (pusher != null) {
            unsubscribe();
            pusher.disconnect();
            pusher = null;
        }
    }

    let onMountDone = false;
    onMount(async () => {
        console.log("import meta env MODE", import.meta.env.MODE);

        setPusherConnection = () => {
            const username =
                input_username === "" ? Date.now().toString() : input_username;
            console.log("username is", username);

            if (username) {
                console.log("connecting");
                alert_data = {
                    title: "Connecting",
                    msg: null,
                    type: "info",
                };
                // connect to Pusher:
                if (pusher === null) {
                    pusher = new Pusher(data.APP_KEY, {
                        cluster: data.APP_CLUSTER,
                        channelAuthorization: {
                            endpoint: "/api/pusher/auth",
                            params: { username: username },
                            transport: "ajax",
                        },
                    });
                    console.log("pusher created");
                    alert_data = {
                        title: "Connecting",
                        msg: "Found server",
                        type: "info",
                    };
                }

                const pusher_private_user_channel_name = `private-user-${username}`;
                if (
                    pusher_private_user_channel === null ||
                    pusher_private_user_channel.name !==
                        pusher_private_user_channel_name
                ) {
                    console.log(
                        `subscribing to ${pusher_private_user_channel_name}`
                    );
                    alert_data = {
                        title: "Connecting",
                        msg: "Subscribing",
                        type: "info",
                    };

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
                        async (data) => {
                            console.log("subscription ok: ", data);
                            alert_data = {
                                title: "Connecting",
                                msg: `Subscribed to ${
                                    pusher_private_user_channel!.name
                                }`,
                                type: "info",
                            };

                            pusher_private_user_channel!.bind(
                                "client-paired",
                                (data: { players: string[] }) => {
                                    maybePair(username, "client_paired", data);
                                }
                            );
                        }
                    );
                }
            }
            return username;
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
        onMountDone = true;
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
        alert_data = {
            title: null,
            msg: null,
            type: "info",
        };
        if (!audioContextInited) {
            initAudioContext();
        }

        if ($simonState.context.mode === SimonModes.Solo) {
            withUserInputDisabled(async () => {
                simonService.send(Events.Start);
            });
        } else if ($simonState.context.mode === SimonModes.Duel) {
            if (!is_connected) {
                connect();
            }

            if (is_connected) {
                await fetchOpponents(input_username);
                forceHideStartButton = true;
            } else {
                console.warn("not connected");
            }
        }
    }

    let is_connected = false;
    function connect() {
        input_username = setPusherConnection()!;
        is_connected = true;
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
        if (is_sound_hints) {
            playNote(notes[$simonState.context.opts.indexOf(color)], 0.4);
        }
        colorActive = color;
        await sleep(show_press_duration);
        colorActive = "";
        stopNote();
        await sleep(show_press_gap);
    }

    async function waitNote(note: number | null) {
        if (note != null) {
            playNote(note, 0.4);
        }
        await sleep(200);
        stopNote();
    }

    async function onWin() {
        if (is_SFX) {
            let tune = [0, 1, 2, 3, 1, 3, 0, 0].map((i) => notes[i]);
            for (const note of tune) {
                await waitNote(note);
            }
        }
    }

    async function onFail() {
        if (is_SFX) {
            let tune = [3, 3, 2, 1, 1, null, 3, 3, 2, 1, 1, 1, 1].map((i) =>
                i === null ? null : notes[i]
            );
            for (const note of tune) {
                await waitNote(note);
            }
        }
    }

    type Daily = "daily5" | "daily10";
    let isDaily: Daily | null = null;
    async function setGameMode(mode: SimonModes | Daily) {
        isDaily = null;
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
            case "daily5":
            case "daily10":
                console.debug("daily");
                await setGameMode(SimonModes.Solo);
                isDaily = mode;
                const size = parseInt(mode.substring("daily".length));
                simonSend({
                    type: Events.SetSequence,
                    sequence: await fetchDailySequence(size),
                });
                break;
        }
    }

    async function fetchDailySequence(size: number) {
        let body = { opts: $simonState.context.opts, size: size };
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
                    console.warn({
                        fetch: { sent: body, warn: data.warnings },
                    });
                }
                console.log({ fetch: { sent: body, got: data } });
                return data.sequence;
            });
        return sequence;
    }

    async function fetchChannels() {
        let channels: string[] = await fetch("/api/pusher/channels", {
            method: "GET",
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Network response was not OK");
                }
                return response.json();
            })
            .then((data) => {
                console.log({ fetch: { sent: {}, got: data } });
                return data.channels;
            });
        return channels;
    }

    async function fetchOpponents(username: string, wanted: string[] = []) {
        let available = await fetchChannels();
        available = available.map((x) =>
            x.startsWith("private-user-")
                ? x.substring("private-user-".length)
                : x
        );
        available = available.filter((name) => name !== username);
        if (available.length === 0) {
            console.warn("No available opponents");
            alert_data = {
                title: "Warning",
                msg: "No available opponents",
                type: "warning",
            };
        } else {
            let opponents: string[];
            if (wanted.length === 0) {
                opponents = [available[0]];
            } else {
                opponents = wanted.filter((name) => available.includes(name));
            }
            const players = [username, ...opponents];
            maybePair(username, "fetchOpponents", { players: players });
        }
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
    import Alert from "$lib/Alert.svelte";
    import LiorKBar from "$lib/LiorKBar.svelte";
    import Toggle from "$lib/Toggle.svelte";

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
    $: progress_ring_color =
        $simonState.context.sequence.length ===
        $simonState.context.currentSequence.length
            ? "black"
            : "gainsboro";

    let alert_data = {
        title: null,
        msg: null,
        type: "info",
    } as {
        title: string | null;
        msg: string | null;
        type: "info" | "warning" | "error";
    };
    function nullOrEmpty(x: string | null): boolean {
        return x === null || x.length === 0;
    }
    $: alert_hidden =
        nullOrEmpty(alert_data.title) && nullOrEmpty(alert_data.msg);
    function resetAlert() {
        alert_data = {
            title: null,
            msg: null,
            type: "info",
        };
    }

    let is_SFX = true;
    let is_sound_hints = true;
    let is_mute = false;
    $: if (is_mute) {
        is_SFX = false;
        is_sound_hints = false;
    }
</script>

<!-- https://codesandbox.io/s/nmdi4 -->

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
                btnClass={isDaily === null &&
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
                btnClass={isDaily === "daily5"
                    ? "selectedGameMode"
                    : "baseGameMode"}
                on:click={() => setGameMode("daily5")}
                disabled={!$simonState.can({
                    type: Events.SetMode,
                    mode: SimonModes.Solo,
                })}
            >
                Daily 5
            </SettingsButton>
            <SettingsButton
                btnClass={isDaily === "daily10"
                    ? "selectedGameMode"
                    : "baseGameMode"}
                on:click={() => setGameMode("daily10")}
                disabled={!$simonState.can({
                    type: Events.SetMode,
                    mode: SimonModes.Solo,
                })}
            >
                Daily 10
            </SettingsButton>
            <SettingsButton
                btnClass={isDaily === null &&
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

        <div id="settings_col" class="grid gap-y-1">
            {#if $simonState.context.mode === SimonModes.Solo}
                <p>
                    <label for="settingsStepSize">Step</label>
                    <input
                        id="settingsStepSize"
                        type="number"
                        placeholder="step:"
                        min={STEP_MIN}
                        max={STEP_MAX}
                        bind:value={step}
                        style:width="5rem"
                        class="text-sm rounded-lg focus:ring-device-color1 focus:border-device-color1"
                    />
                </p>
            {/if}
            <Toggle text="SFX" bind:checked={is_SFX} disabled={is_mute} />
            <Toggle
                text="Sound Hint"
                bind:checked={is_sound_hints}
                disabled={is_mute}
            />
            <Toggle text="Mute" bind:checked={is_mute} disabled={false} />
        </div>

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
            <div>
                <input
                    type="text"
                    bind:value={input_username}
                    placeholder="username:"
                    disabled={!is_game_off || is_connected}
                />
                <SettingsButton
                    on:click={() => {
                        connect();
                    }}
                    disabled={!is_game_off || is_connected}
                >
                    {is_connected
                        ? `Connected as ${input_username}`
                        : "Connect"}
                </SettingsButton>
            </div>
            <br />
            <pre>
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
        {#if onMountDone}
            {#each $simonState.context.opts as color, i}
                {@const { color: fgcolor, active: activecolor } =
                    optProps[color]}
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
        {/if}

        <div class="center">
            <div class="transition-container">
                {#if !forceHideStartButton && is_game_off}
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
<Alert
    title={alert_data.title}
    msg={alert_data.msg}
    type={alert_data.type}
    bind:hidden={alert_hidden}
    on:click={resetAlert}
    on:hide={resetAlert}
/>
<footer>
    <LiorKBar />
</footer>

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

    footer {
        display: flex;
        justify-content: center;
        position: absolute;
        bottom: 0;
        width: 100%;
    }
</style>
