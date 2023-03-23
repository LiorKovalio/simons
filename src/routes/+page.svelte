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
    let duel_status: "off"|"subscribed"|"playing" = "off"
    let input_username = "";
    let paired_players: string[] = [];

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
        console.error("Error", "Subscription error occurred. Please restart the app");
    }

    function maybePair(username: string, event_name: string, data: {players: string[]}): boolean {
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

            pc.trigger("client-paired", { players: players, });

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
            other_subscriptions.forEach((name) =>
                pusher!.unsubscribe(name)
            );
            other_subscriptions = [];
            pusher.disconnect();
            pusher = null;
        }
    }

    onMount(async () => {
        console.log("import meta env MODE", import.meta.env.MODE);

        setPusherConnection = () => {
            const username = input_username === "" ? Date.now().toString() : input_username;
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
                pusher_private_user_channel.bind("pusher:subscription_error", onPusherSubscriptionError);

                // subscription to their own channel succeeded
                pusher_private_user_channel.bind("pusher:subscription_succeeded", (data) => {
                    console.log("subscription ok: ", data);
                    duel_status = "subscribed";

                    pusher_private_user_channel!.bind(
                        "waiting_for_opponent",
                        (data) => {
                            console.log("waiting for opponent", data);
                        }
                    );

                    pusher_private_user_channel!.bind("paired", (data: { players: string[] }) => {
                        maybePair(username, "paired", data);
                    });

                    pusher_private_user_channel!.bind("client-paired", (data: { players: string[] }) => {
                        maybePair(username, "client_paired", data);
                    });
                });
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

    function handleGameModeClick() {
        if ($simonState.context.mode === SimonModes.Solo) {
            simonSend({ type: Events.SetMode, mode: SimonModes.Duel });
        } else if ($simonState.context.mode === SimonModes.Duel) {
            forceHideStartButton = false;
            closeConnection();
            simonSend({ type: Events.SetMode, mode: SimonModes.Solo });
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
</script>

<!-- https://codesandbox.io/s/nmdi4 -->


{#each sfxs as s, i}
    <audio src="audio/{s}.mp3" preload="auto" bind:this={sfxsBinds[i]}>
        <track kind="captions" />
    </audio>
{/each}

<header>
    {#if !import.meta.env.PROD}
        <pre>
simonState: {$simonState.value}
    mode: {$simonState.context.mode}
    sequence: {$simonState.context.sequence}
    current: {$simonState.context.currentSequence}
        </pre>
    {/if}
    <button
        type="button"
        on:click={handleGameModeClick}
        disabled={!$simonState.can({
            type: Events.SetMode,
            mode: SimonModes.Duel,
        })}
    >
        {$simonState.context.mode}
    </button>
    <button
        type="button"
        on:click={repeat}
        disabled={disabled || !(
            ($simonState.value === States.WaitingForUser &&
                $simonState.context.currentSequence.length === 0) ||
            $simonState.value === States.Fail ||
            $simonState.value === States.Win
        )}
    >
        repeat
    </button>
    {#if $simonState.context.mode === SimonModes.Duel}
        <br />
        <input type="text" bind:value={input_username} placeholder="username:" />
        <br />
        <pre>
duel_status: {duel_status}
input_username: {input_username}
players: {paired_players}

simonState: {$simonState.value}
    mode: {$simonState.context.mode}
        </pre>
    {/if}
</header>

<section
    style:--borders-color={border_color}
    style:--device-size={device_size}
    style:--pad_size="calc({device_size}/2)"
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
            {#if !forceHideStartButton && ($simonState.value === States.Off || $simonState.value === States.Fail || $simonState.value === States.Win)}
                <button class="start" on:click={startGame}>Simon</button>
            {/if}
        </div>
    </div>
</section>

<style>
    * {
        box-sizing: border-box;
        user-select: none;
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
        background-color: #9a2257;
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
</style>
