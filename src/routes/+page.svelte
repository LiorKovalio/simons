<!-- https://codesandbox.io/s/nmdi4 -->
<script lang="ts">
    import { onMount } from "svelte";

    import { useMachine } from '@xstate/svelte';

    import type { Socket } from "socket.io-client";
    import ioClient from "socket.io-client";

    import { States, Events, simonMachine, SimonModes } from "../lib/simonLogic";
    import { sleep } from "../lib/sleep";



    const { state: simonState, send: simonSend, service: simonService } = useMachine(simonMachine);
    simonService
        .onTransition(async (state) => {
            console.log(`${state.value}\n\tsequence: ${state.context.sequence}\n\tcurrent: ${state.context.currentSequence}`);
            console.log(`\tmode: ${state.context.mode}`);
            switch (state.value) {
                case States.WaitingForUser:
                    if (state.context.sequence.length > 0 && state.context.currentSequence.length === 0) {
                        await withUserInputDisabled(async () => {
                            allActive = true;
                            await sleep(show_press_gap);
                            allActive = false;
                            await sleep(show_press_gap);
                            await playSequence(state.context.sequence);
                        });
                    }
                    break;
                default:
                    break;
            }
        })
        .onEvent((event) => {
            console.dir(event);
            switch (event.type) {
                case Events.Click:
                    if ($simonState.context.mode === SimonModes.Duel && io) {
                        const e = event as { type: Events.Click, opt: string };
                        if ($simonState.value === States.WaitingForUser || $simonState.value === States.WaitingForExtension) {
                            io.emit("user clicked", e.opt, (v: any) => {
                                console.log(`server: ${v}`);
                            });
                        }
                    }
                    break;
                case Events.SetMode:
                    const e = event as { type: Events.SetMode, mode: SimonModes };
                    toggleConnection(e.mode);
                    break;
            }
        })
        .start();

    let sfxs = ["a4", "c4", "e4", "g4"];
    let notes = [440, 261, 329, 392];
    let show_press_duraion = 500;
    let show_press_gap = 500;

    let status = "waiting_for_start";
    let disabled = true;
    let allActive = false;
    let colorActive = "";

    // connection vars, inited on onMount. see "onMount setConnection"
    let setConnection = () => {};
    let io: Socket | null;

    // audio vars, inited on onMount. see "onMount audioContext"
    let oscillator: OscillatorNode | null;
    let gainNode: GainNode | null;
    let audioContextInited = false;
    let initAudioContext = () => { audioContextInited = true; };

    onMount(async () => {
        // onMount setConnection
        setConnection = () => {
            const ENDPOINT = "http://localhost:3000";
            // const ENDPOINT = "192.168.1.225:3000";
            const socket = ioClient(ENDPOINT);

            socket.on("self", function (msg) {
                console.log(`id on server : "${msg}"`);
            });
            socket.on("waiting for opponent", function () {
                status = "waiting_for_opponent";
            });
            socket.on("paired", function (myTurn: boolean) {
                console.log("myTurn?", myTurn);
                status = myTurn
                    ? "waiting_for_user_move"
                    : "waiting_for_opponent_move";
                disabled = !myTurn;
                simonSend({ type: Events.Start, myTurn: myTurn });
            });
            socket.on("opponent clicked", async function (msg) {
                if ($simonState.value === States.WaitingForOpponent) {
                    console.log(`opponent clicked : "${msg}"`);
                    simonSend({ type: Events.Click, opt: msg});
                } else {
                    console.error("not expecting opponent play");
                }
            });
            io = socket;
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

    async function withUserInputDisabled(func: ()=>void) {
        disabled = true;
        status = "playing_seq";
        const res = await func();
        status = "waiting_for_user";
        disabled = false;
        return res;
    }

    async function startGame() {
        initAudioContext();
        withUserInputDisabled(async () => {
            simonService.send(Events.Start);
        });
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

    // async function padClick(color: string) {
    //     if (
    //         gameMode === "duel" &&
    //         (status === "waiting_for_user_move" ||
    //             (status === "waiting_for_user" &&
    //                 isSameSeq(pattern, userPattern)))
    //     ) {
    //         disabled = true;
    //         status = "waiting_for_opponent_move";
    //         console.log("user added", color);
    //         await lightPad(color);
    //         pattern.push(color);
    //         io.emit("user added", color, (v) => {
    //             console.log(`server: ${v}`);
    //         });
    //         return;
    //     }
    //     if (pattern.length == 0) {
    //         return;
    //     }
    //     // if (status !== "waiting_for_user") { // ignore user
    //     //     return;
    //     // }
    //     console.log("user clicked", color);
    //     if (gameMode === "duel") {
    //         io.emit("user clicked", color, (v) => {
    //             console.log(`server: ${v}`);
    //         });
    //     }
    //     userPattern.push(color);
    //     const i = userPattern.length - 1;
    //     if (userPattern[i] === pattern[i]) {
    //         // user right color
    //         await lightPad(color);
    //         if (userPattern.length === pattern.length) {
    //             withUserInputDisabled(async () => {
    //                 userPattern = [];
    //                 allActive = true;
    //                 await sleep(show_press_gap);
    //                 allActive = false;
    //                 if (gameMode === "solo") {
    //                     await sleep(show_press_gap);
    //                     pattern = extendPattern(pattern);
    //                     await playSeq();
    //                     console.log("pattern:", pattern);
    //                 } else if (gameMode === "duel") {
    //                     status = "waiting_for_user_move";
    //                 }
    //             });
    //         }
    //     } else {
    //         console.log("wrong color");
    //         console.log("pattern:", pattern);
    //         console.log("userPattern:", userPattern);
    //         // reset game
    //         reset();
    //     }
    // }

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
            simonSend({ type: Events.SetMode, mode: SimonModes.Solo });
        }
    }

    function toggleConnection(mode: SimonModes) {
        console.log(mode);
        if (mode === SimonModes.Solo) {
            io = null;
        } else if (mode === SimonModes.Duel) {
            setConnection();
            if (!audioContextInited) {
                initAudioContext();
            }
        }
    }
</script>

{#each sfxs as s, i}
    <audio src="audio/{s}.mp3" preload="auto" bind:this={sfxsBinds[i]}>
        <track kind="captions" />
    </audio>
{/each}

<header>
    <p>status: {status}</p>
    <pre>
simonState: {$simonState.value}
    mode: {$simonState.context.mode}
    sequence: {$simonState.context.sequence}
    current: {$simonState.context.currentSequence}
    </pre>
    <button
        type="button"
        on:click={handleGameModeClick}
        disabled={!$simonState.can({ type: Events.SetMode, mode: SimonModes.Duel })}
        >
        {$simonState.context.mode}
    </button>
    <button
        type="button"
        on:click={repeat}
        disabled={!(status === "waiting_for_user" && $simonState.context.currentSequence.length === 0)}
    >
        repeat
    </button>
</header>

<section>
    <div id="circle" class="circle">
        {#each $simonState.context.opts as color}
            <button
                class:active={colorActive === color || allActive}
                class="{color} pad"
                on:click={async () => {
                    // await padClick(color);

                    // await withUserInputDisabled(async ()=>{
                    //     await lightPad(color);
                    //     simonSend({ type: Events.Click, opt: color });
                    // });

                    await lightPad(color);
                    simonSend({ type: Events.Click, opt: color });
                }}
                {disabled}
            />
        {/each}

        <div class="center">
            {#if $simonState.context.mode === SimonModes.Solo && ($simonState.value === States.Off || $simonState.value === States.Fail)}
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
