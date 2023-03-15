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
    let input_username = "";

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

    function setTransportToOther(p: string) {
        const channel_name = `private-user-${p}`;
        other_subscriptions.push(channel_name);
        const pc = pusher!.subscribe(channel_name);
        pc.bind("pusher:subscription_error", onPusherSubscriptionError);

        pc.bind("pusher:subscription_succeeded", (data) => {
            console.log("opponent subscription ok: ", data);

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

                    pusher_private_user_channel!.bind(
                        "waiting_for_opponent",
                        (data) => {
                            console.log("waiting for opponent", data);
                        }
                    );

                    pusher_private_user_channel!.bind("paired", (data: { players: string[] }) => {
                        if (
                            $simonState.value === States.Off ||
                            $simonState.value === States.Fail ||
                            $simonState.value === States.Win
                        ) {
                            forceHideStartButton = false;
                            console.log("got event \"paired\" with data:", data);
                            if ("players" in data && data.players.length > 0) {
                                const myTurn = data.players[0] === username;
                                console.log("myTurn?", myTurn);
                                disabled = !myTurn;

                                data.players.forEach((p: string) => {
                                    if (p !== username) {
                                        console.log(username, "working with", p);
                                        setTransportToOther(p);
                                    }
                                });

                                simonSend({
                                    type: Events.Start,
                                    myTurn: myTurn,
                                });
                            } else {
                                console.error("bad data. missing players");
                            }
                        } else {
                            console.error("not waiting for pairing");
                        }
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

    // function toggleConnection(mode: SimonModes) {
    //     console.log(mode);
    //     if (mode === SimonModes.Solo) {
    //         if (pusher != null) {
    //             pusher.allChannels().forEach(c => pusher.unsubscribe(c.name));
    //             pusher = null;
    //             if (pusher_private_user_channel != null) {
    //                 pusher_private_user_channel = null;
    //             }
    //         }
    //     } else if (mode === SimonModes.Duel) {
    //         setPusherConnection();
    //         if (!audioContextInited) {
    //             initAudioContext();
    //         }
    //     }
    // }
</script>

<!-- https://codesandbox.io/s/nmdi4 -->


{#each sfxs as s, i}
    <audio src="audio/{s}.mp3" preload="auto" bind:this={sfxsBinds[i]}>
        <track kind="captions" />
    </audio>
{/each}

<header>
    <pre>
simonState: {$simonState.value}
    mode: {$simonState.context.mode}
    sequence: {$simonState.context.sequence}
    current: {$simonState.context.currentSequence}
    </pre>
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
        disabled={!(
            ($simonState.value === States.WaitingForUser &&
                $simonState.context.currentSequence.length === 0) ||
            $simonState.value === States.Fail ||
            $simonState.value === States.Win
        )}
    >
        repeat
    </button>
    <input type="text" bind:value={input_username} />
</header>

<section>
    <div id="circle" class="circle">
        {#each $simonState.context.opts as color}
            <button
                class:active={colorActive === color || allActive}
                class="{color} pad"
                on:click={async () => {
                    await lightPad(color);
                    simonSend({ type: Events.Click, opt: color });
                }}
                {disabled}
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
        --size: 60vmin;
        --borders-size: 2.5vmin;
        --borders-color: #58224f;
        font-size: 7vmin;
        height: var(--size);
        width: var(--size);
        background-color: var(--borders-color);
        border-radius: 50%;
        overflow: hidden;
        display: grid;
        grid-gap: var(--borders-size);
        position: relative;
        box-shadow: 0 0 0px var(--borders-size) var(--borders-color);
        grid-template-areas:
            "green red"
            "yellow blue";
    }

    .start {
        cursor: pointer;
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

    .pad {
        --radius: 310px;
        cursor: pointer;
        transition: all 100ms linear;
        background-color: #3b0063;
        border-style: none;
    }
    .pad:disabled {
        filter: saturate(0);
    }

    .pad.active,
    .pad:hover {
        filter: saturate(3);
    }
    .green {
        grid-area: green;
        background-color: #1bd871;
        border-radius: var(--radius) 0 0 0;
    }

    .blue {
        grid-area: blue;
        background-color: #209adb;
        border-radius: 0 0 var(--radius) 0;
    }

    .red {
        grid-area: red;
        background-color: #fa4a30;
        border-radius: 0 var(--radius) 0px 0;
    }

    .yellow {
        grid-area: yellow;
        background-color: #f2da2b;
        border-radius: 0 0 0 var(--radius);
    }
</style>
