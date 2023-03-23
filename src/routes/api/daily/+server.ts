import { json } from '@sveltejs/kit';

import seedrandom from 'seedrandom';

const seed = "simonsecret" + new Date().toDateString();

function getRandomOpt(random: any, range: number) {
    return Math.floor(random() * range);
}

function randomChoice(opts: any[], size: number) {
    const random = seedrandom(seed);
    let out = [];
    for (let i = 0; i < size; i++) {
        out.push(opts[getRandomOpt(random, opts.length)]);
    }
    return out;
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
    const asjson = await request.json();
    console.log(asjson);
    const opts = asjson.opts;
    const size = asjson.size;
    const sequence = randomChoice(opts, size);
    console.log("sequence", sequence);

    return json({ status: 200, sequence: sequence, });
}
