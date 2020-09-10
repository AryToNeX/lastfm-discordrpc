// This work is licensed under the Apache 2.0 License
// See the LICENSE file for details
"use strict";

const discord = require("discord-rpc");
const https = require("https");

const config = require("./config.json");

const lastfm = {
	apiKey: config.lastfm.apiKey,
	name: config.lastfm.name
};

let _previousTrack;

module.exports = class LastFM {
	
	pull(){
		try{
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
				
					if(!this.rpc){
						console.error("Discord died! Stopping and starting again");
						this.connected = false;
						await this.stop();
						await this.start();
						return;
					}
				
					try{
						if(track.nowplaying){
							await this.rpc.setActivity({
								details: `"${track.name}" by ${track.artist}`,
								state: `on "${track.album}"`,
								largeImageKey: 'lastfm',
								largeImageText: 'last.fm/user/' + lastfm.name,
								instance: false
							});
						}else{
							await this.rpc.clearActivity();
						}
					}catch(e){
						console.error("RPC gave an error!", e);
					}
				});
			});
		}catch(e){
			console.error("HTTPS request to Last.fm couldn't be done!", e);
		}
	}
	
	async start(){
		console.log("Discordrp LastFM connecting");

		this.connected = false;
		do{
			try{
				this.rpc = new discord.Client({transport: "ipc"});
				this.rpc.on("ready", () => {this._onReady()});
				await this.rpc.login({clientId: config.discordClientID});
				this.connected = true;
			}catch(e){
				console.error(e);
				await new Promise(resolve => {setTimeout(resolve, 1000)});
			}
		}while(!this.connected);
		console.log("Discordrp LastFM connected");
	}
	
	async stop(){
		console.log("Discordrp LastFM stopping");
		if(this.connected) await this.rpc.clearActivity();
		if(typeof this.interval !== "undefined") clearInterval(this.interval);
		return;
	}
	
	_onReady(){
		this.pull();
		this.interval = setInterval(() => {this.pull()}, 1e3);
	}
}
