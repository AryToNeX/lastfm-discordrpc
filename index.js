// This work is licensed under the Apache 2.0 License
// See the LICENSE file for details
"use strict";

const lastfm = new (require("./func.js"))();

process.on('SIGTERM', exit);
process.on('SIGINT', exit);

lastfm.start();

async function exit(){
	await lastfm.stop();
	process.exit(0);
}
