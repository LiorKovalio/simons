import { createMachine, assign, interpret  } from 'xstate';

function getRandomOpt(range: number) {
    return Math.floor(Math.random() * range);
}

function extendPattern(pattern: string[], opts: string[]) {
    const randomColor = opts[getRandomOpt(opts.length)];
    return [...pattern, randomColor];
}

export const enum States {
    Off = "Off",
    WaitingForUser = "WaitingForUser",
    Working = "Working",
    Fail = "Fail",
    // duel states
    WaitingForExtension = "WaitingForExtension",
    WaitingForOpponent = "WaitingForOpponent",
    Win = "Win",
    // WaitingForUserMove = "WaitingForUserMove",
    // WaitingForOpponentMove = "WaitingForOpponentMove",
}

export const enum Events {
    Start = "Start",
    Click = "Click",
    SetMode = "SetMode",
}

export const enum SimonModes {
    Solo = "Solo",
    Duel = "Duel",
}

function isClickCorrect(sequence: string[], currentSequence: string[], click: string): boolean {
    return sequence[currentSequence.length] === click;
}

export const simonMachine = createMachine({
    predictableActionArguments: true,
    schema: {
        context: {} as { opts: string[], mode: SimonModes, sequence: string[], currentSequence: string[] },
        events: {} as { type: Events.Start, myTurn?: boolean } | { type: Events.Click, opt: string } | { type: Events.SetMode, mode: SimonModes }
    },
    initial: States.Off,
    context: {
        opts: ["red", "green", "yellow", "blue"],
        mode: SimonModes.Solo,
        sequence: [],
        currentSequence: [],
    },
    states: {
        [States.Off]: {
            on: {
                [Events.SetMode]: {
                    actions: assign({
                        mode: (context, event) => event.mode,
                    }),
                },
                [Events.Start]: [
                    {
                        target: States.Working,
                        actions: assign({ currentSequence: [], sequence: [] }),
                        cond: (context, event) => event.myTurn === undefined || event.myTurn === true 
                    },
                    {
                        target: States.WaitingForOpponent,
                        actions: assign({ currentSequence: [], sequence: [] }),
                        cond: (context, event) => !event.myTurn
                    },
                ],
            }
        },
        [States.WaitingForUser]: {
            on: {
                [Events.Click]: [
                    {
                        target: States.Working,
                        actions: assign({ currentSequence: (context, event) => [...context.currentSequence, event.opt] }),
                        cond: (context, event) => context.sequence.length === context.currentSequence.length + 1 && isClickCorrect(context.sequence, context.currentSequence, event.opt),
                    },
                    {
                        actions: assign({ currentSequence: (context, event) => [...context.currentSequence, event.opt] }),
                        cond: (context, event) => isClickCorrect(context.sequence, context.currentSequence, event.opt),
                    },
                    { target: States.Fail },
                ],
            },
        },
        [States.Working]: {
            always: [
                {
                    target: States.WaitingForUser,
                    actions: assign({
                        sequence: (context, event) => extendPattern(context.sequence, context.opts),
                        currentSequence: [],
                    }),
                    cond: (context, event) => context.mode === SimonModes.Solo
                },
                {
                    target: States.WaitingForExtension,
                    cond: (context, event) => context.mode === SimonModes.Duel
                },
            ]
        },
        [States.Fail]: {
            on: {
                [Events.SetMode]: {
                    actions: assign({
                        mode: (context, event) => event.mode,
                    }),
                },
                [Events.Start]: {
                    target: States.Working,
                    actions: assign({ currentSequence: [], sequence: [] }),
                },
                [Events.Click]: undefined,
            },
        },
        // duel states
        [States.WaitingForExtension]: {
            on: {
                [Events.Click]: [
                    {
                        target: States.WaitingForOpponent,
                        actions: assign({
                            sequence: (context, event) => [...context.sequence, event.opt],
                            currentSequence: [],
                        }),
                    },
                ],
            },
        },
        [States.WaitingForOpponent]: {
            on: {
                [Events.Click]: [
                    {
                        target: States.WaitingForUser,
                        actions: assign({
                            sequence: (context, event) => [...context.sequence, event.opt],
                            currentSequence: [],
                        }),
                        cond: (context, event) => context.sequence.length === context.currentSequence.length,
                    },
                    {
                        actions: assign({ currentSequence: (context, event) => [...context.currentSequence, event.opt] }),
                        cond: (context, event) => isClickCorrect(context.sequence, context.currentSequence, event.opt),
                    },
                    { target: States.Win },
                ],
            },
        },
        [States.Win]: {
            on: {
                [Events.SetMode]: {
                    actions: assign({
                        mode: (context, event) => event.mode,
                    }),
                },
                [Events.Start]: {
                    target: States.Working,
                    actions: assign({ currentSequence: [], sequence: [] }),
                },
                [Events.Click]: undefined,
            },
        },

    },
});

// Machine instance with internal state
// export const simonService = interpret(simonMachine)
//   .onTransition((state) => console.log(state.value, state.context))
//   .onEvent((event)=> console.log(event))
//   .start();

// let innerState;
// innerState = simonService.send(Events.Start);
// for (let index = 0; index < 3; index++) {
//     console.log(index);
//     const curlen = innerState.context.sequence.length;
//     for (let j = 0; j < curlen; j++) {
//         const oracle = innerState.context.sequence[innerState.context.currentSequence.length];
//         innerState = simonService.send({ type: Events.Click, opt: oracle });
//     }
// }
