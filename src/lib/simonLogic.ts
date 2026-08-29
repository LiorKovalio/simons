import { createMachine, assign, setup } from 'xstate';

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
    WaitingForExtension = "WaitingForExtension",
    WaitingForOpponent = "WaitingForOpponent",
    Win = "Win",
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
    };
}

const simonMachine = setup({
    types: {
        context: {} as {
            opts: string[];
            mode: SimonModes;
            sequence: string[];
            currentSequence: string[];
            extendFunc: (sequence: string[], opts: string[], step: number) => string[];
            maxSequenceLength: number;
            step: number;
        },
        events: {} as
            | { type: Events.Start; myTurn?: boolean }
            | { type: Events.Click; opt: string }
            | { type: Events.SetMode; mode: SimonModes }
            | { type: Events.SetSequence; sequence: string[] }
            | { type: Events.SetStep; step: number },
    },
    guards: {
        isMyTurn: ({ event }) => event.type === Events.Start && (event.myTurn === undefined || event.myTurn === true),
        notMyTurn: ({ event }) => event.type === Events.Start && !event.myTurn,
        isSoloMode: ({ context }) => context.mode === SimonModes.Solo,
        isDuelMode: ({ context }) => context.mode === SimonModes.Duel,
        sequenceComplete: ({ context }) =>
            context.maxSequenceLength > 0 && context.maxSequenceLength === context.sequence.length,
        lastClickCorrect: ({ context, event }) =>
            event.type === Events.Click &&
            context.sequence.length === context.currentSequence.length + 1 &&
            isClickCorrect(context.sequence, context.currentSequence, event.opt),
        clickCorrect: ({ context, event }) =>
            event.type === Events.Click && isClickCorrect(context.sequence, context.currentSequence, event.opt),
        waitingForUserDone: ({ context }) =>
            context.sequence.length === context.currentSequence.length,
    },
    actions: {
        setMode: assign(({ event }) => (event.type === Events.SetMode ? { mode: event.mode } : {})),
        setSequence: assign(({ event }) => {
            if (event.type === Events.SetSequence) {
                if (event.sequence.length === 0) {
                    return { extendFunc: extendPattern, maxSequenceLength: -1 };
                } else {
                    return {
                        extendFunc: predefinedSequence(event.sequence),
                        maxSequenceLength: event.sequence.length,
                    };
                }
            }
            return {};
        }),
        resetSequences: assign({ currentSequence: [], sequence: [] }),
        addClickToCurrent: assign(({ context, event }) =>
            event.type === Events.Click ? { currentSequence: [...context.currentSequence, event.opt] } : {}
        ),
        extendSequence: assign(({ context }) => ({
            sequence: context.extendFunc(context.sequence, context.opts, context.step),
            currentSequence: [],
        })),
        addExtensionAndSwitch: assign(({ context, event }) =>
            event.type === Events.Click ? { sequence: [...context.sequence, event.opt], currentSequence: [] } : {}
        ),
        addOpponentClickAndSwitch: assign(({ context, event }) =>
            event.type === Events.Click ? { sequence: [...context.sequence, event.opt], currentSequence: [] } : {}
        ),
        setStep: assign(({ event }) => (event.type === Events.SetStep ? { step: event.step } : {})),
    },
}).createMachine({
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
                [Events.SetMode]: { actions: 'setMode' },
                [Events.SetSequence]: { actions: 'setSequence' },
                [Events.Start]: [
                    { target: States.Working, actions: 'resetSequences', guard: 'isMyTurn' },
                    { target: States.WaitingForOpponent, actions: 'resetSequences', guard: 'notMyTurn' },
                ],
            },
        },
        [States.WaitingForUser]: {
            on: {
                [Events.Click]: [
                    { target: States.Working, actions: 'addClickToCurrent', guard: 'lastClickCorrect' },
                    { actions: 'addClickToCurrent', guard: 'clickCorrect' },
                    { target: States.Fail },
                ],
            },
        },
        [States.Working]: {
            always: [
                { target: States.Win, guard: ({ context }) => context.mode === SimonModes.Solo && context.maxSequenceLength > 0 && context.maxSequenceLength === context.sequence.length },
                { target: States.WaitingForUser, actions: 'extendSequence', guard: 'isSoloMode' },
                { target: States.WaitingForExtension, guard: 'isDuelMode' },
            ],
        },
        [States.Fail]: {
            on: {
                [Events.SetMode]: { target: States.Off, actions: 'setMode' },
                [Events.SetSequence]: { actions: 'setSequence' },
                [Events.Start]: [
                    { target: States.Working, actions: 'resetSequences', guard: 'isMyTurn' },
                    { target: States.WaitingForOpponent, actions: 'resetSequences', guard: 'notMyTurn' },
                ],
                [Events.Click]: { actions: [] },
            },
        },
        [States.WaitingForExtension]: {
            on: {
                [Events.Click]: [
                    { target: States.WaitingForOpponent, actions: 'addExtensionAndSwitch' },
                ],
            },
        },
        [States.WaitingForOpponent]: {
            on: {
                [Events.Click]: [
                    { target: States.WaitingForUser, actions: 'addOpponentClickAndSwitch', guard: 'waitingForUserDone' },
                    { actions: 'addClickToCurrent', guard: 'clickCorrect' },
                    { target: States.Win },
                ],
            },
        },
        [States.Win]: {
            on: {
                [Events.SetMode]: { target: States.Off, actions: 'setMode' },
                [Events.SetSequence]: { actions: 'setSequence' },
                [Events.Start]: [
                    { target: States.Working, actions: 'resetSequences', guard: 'isMyTurn' },
                    { target: States.WaitingForOpponent, actions: 'resetSequences', guard: 'notMyTurn' },
                ],
                [Events.Click]: { actions: [] },
            },
        },
    },
    on: {
        [Events.SetStep]: { actions: 'setStep' },
    },
});

export { simonMachine };