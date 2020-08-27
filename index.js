// This work is licensed under the Apache 2.0 License
// See the LICENSE file for details
"use strict";

const discord = new (require("discord-rpc")).Client({transport: "ipc"});
const https = require("https");

const config = require("./config.json");

const lastfm = {
	apiKey: config.lastfm.apiKey,
	name: config.lastfm.name
};

let _previousTrack;

process.on('SIGTERM', exit);
process.on('SIGINT', exit);

discord.on('ready', () => {
	pull();
	setInterval(pull, 1e3);
});
discord.login({clientId: config.discordClientID}).catch(console.error);

function pull(){
	https.get('https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=' + lastfm.name + '&api_key=' + lastfm.apiKey + '&limit=1&format=json', res => {
		
		if(res.statusCode !== 200){
			console.error("HTTP request from Last.fm was not ok! Status code is " + res.statusCode);
			return;
		}
		
		let rawData = Buffer.alloc(0);
		res.on("data", chunk => {rawData = Buffer.concat([rawData, chunk])});
		res.on("end", async () => {
			const data = JSON.parse(rawData.toString());
			const track = {
				nowplaying: (typeof data.recenttracks.track[0]["@attr"] !== "undefined" && data.recenttracks.track[0]["@attr"].nowplaying === "true"),
				name: data.recenttracks.track[0].name,
				artist: data.recenttracks.track[0].artist['#text'],
				album: data.recenttracks.track[0].album['#text']
			};
			
			// Simple check to avoid spamming the RPC
			if(typeof _previousTrack !== "undefined" && JSON.stringify(track) === JSON.stringify(_previousTrack))
				return;
			else
				_previousTrack = track;
			
			console.log("Currently playing:", track);
			
			if(!discord){
				console.error("Discord died!");
				return;
			}
			
			if(track.nowplaying){
				await discord.setActivity({
					details: `"${track.name}" by ${track.artist}`,
					state: `on "${track.album}"`,
					largeImageKey: 'lastfm',
					largeImageText: 'last.fm/user/' + lastfm.name,
					instance: false
				});
			}else{
				await discord.clearActivity();
			}
		});
	});
}

async function exit(){
	await discord.clearActivity();
	process.exit(0);
}
