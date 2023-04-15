import { json } from '@sveltejs/kit';
import { APP_SIMON_SECRET } from '$env/static/private';

import seedrandom from 'seedrandom';

const SEQUENCE_MAX_SIZE = 20;
const seed = APP_SIMON_SECRET + new Date().toDateString();

function getRandomOpt(random: any, range: number) {
    return Math.floor(random() * range);
}

function randomChoice(opts: any[], size: number) {
    const random = seedrandom(seed + size.toString());
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
    let size = asjson.size;
    let warnings = [];

    if (size > SEQUENCE_MAX_SIZE) {
        const max_size_exceeded_warning = {
            msg: `maximum sequence size exceeded. returns sequnce of length SEQUENCE_MAX_SIZE (${SEQUENCE_MAX_SIZE})`,
            max_size: SEQUENCE_MAX_SIZE,
            req_size: size
        };
        warnings.push(max_size_exceeded_warning);
        console.warn(max_size_exceeded_warning);
        size = SEQUENCE_MAX_SIZE;
    }

    const sequence = randomChoice(opts, size);
    console.log("sequence", sequence);

    return json({ status: 200, sequence: sequence, warnings: warnings, });
}
