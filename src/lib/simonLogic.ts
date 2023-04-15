import { createMachine, assign } from 'xstate';

function getRandomOpt(range: number) {
    return Math.floor(Math.random() * range);
}

function extendPattern(pattern: string[], opts: string[], step: number = 1) {
    const extension = [...Array(step)].map(_ => opts[getRandomOpt(opts.length)]);
    return [...pattern, ...extension];
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
    SetSequence = "SetSequence",
    SetStep = "SetStep",
}

export const enum SimonModes {
    Solo = "Solo",
    Duel = "Duel",
}

function isClickCorrect(sequence: string[], currentSequence: string[], click: string): boolean {
    return sequence[currentSequence.length] === click;
}

function predefinedSequence(seq: string[]): (p: string[], opts: string[], step: number) => string[] {
    seq = seq.reverse();
    return (p: string[], opts: string[], step: number) => {
        let extension = [];
        for (let i = 0; i < step; i++) {
            if (seq.length > 0) {
                extension.push(seq.pop()!);
            } else {
                break;
            }
        }
        return [...p, ...extension];
    }
}

function setSequence(context, event) {
    if (event.sequence.length === 0) {
        return {
            extendFunc: extendPattern,
            maxSequenceLength: -1,
        }
    } else {
        return {
            extendFunc: predefinedSequence(event.sequence),
            maxSequenceLength: event.sequence.length,
        }
    }
}

export const simonMachine = createMachine({
    predictableActionArguments: true,
    schema: {
        context: {} as { opts: string[], mode: SimonModes, sequence: string[], currentSequence: string[], extendFunc: (sequence: string[], opts: string[], step: number) => string[], maxSequenceLength: number, step: number },
        events: {} as { type: Events.Start, myTurn?: boolean } | { type: Events.Click, opt: string } | { type: Events.SetMode, mode: SimonModes } | { type: Events.SetSequence, sequence: string[] } | { type: Events.SetStep, step: number }
    },
    initial: States.Off,
    context: {
        opts: ["red", "green", "yellow", "blue"],
        mode: SimonModes.Solo,
        sequence: [],
        currentSequence: [],
        extendFunc: extendPattern,
        maxSequenceLength: -1,
        step: 1,
    },
    states: {
        [States.Off]: {
            on: {
                [Events.SetMode]: {
                    actions: assign({
                        mode: (context, event) => event.mode,
                    }),
                },
                [Events.SetSequence]: {
                    actions: assign(setSequence),
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
                    target: States.Win,
                    cond: (context, event) => context.mode === SimonModes.Solo && context.maxSequenceLength > 0 && context.maxSequenceLength === context.sequence.length
                },
                {
                    target: States.WaitingForUser,
                    actions: assign({
                        sequence: (context, event) => context.extendFunc(context.sequence, context.opts, context.step),
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
                    target: States.Off,
                    actions: assign({
                        mode: (context, event) => event.mode,
                    }),
                },
                [Events.SetSequence]: {
                    actions: assign(setSequence),
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
                    target: States.Off,
                    actions: assign({
                        mode: (context, event) => event.mode,
                    }),
                },
                [Events.SetSequence]: {
                    actions: assign(setSequence),
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
                [Events.Click]: undefined,
            },
        },

    },
    on: {
        [Events.SetStep]: {
            actions: [
                assign({
                    step: (context, event) => event.step,
                }),
                (context, event) => console.log(context)
            ],
        },
    },
});
