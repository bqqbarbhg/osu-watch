"use strict";

var util = require('util');
var fetch = require('node-fetch');
var jsdom = require('jsdom');
var moment = require('moment');
var _ = require('lodash');

const OSU_GAMEMODES = {
	STD: 0,
	TAIKO: 1,
	CTB: 2,
	MANIA: 3
};

const OSU_BASE_URL = 'https://osu.ppy.sh';
const OSU_COUNTRY_SCOREBOARD_URL = OSU_BASE_URL + '/p/pp/?m=%d&c=%s&page=%d';
const OSU_API_GET_USER = OSU_BASE_URL + '/api/get_user?k=%s&u=%d&m=%d'

const OSU_USER_API_REQUEST_RATE_N = 100;
const OSU_USER_API_REQUEST_RATE_TIME = 30; // seconds

module.exports = function (apiKey)
{

	var delay = time => new Promise(resolve => setTimeout(resolve, time));

	function getDomContext(url)
	{
		return new Promise((resolve, reject) => {
			fetch(url)
			.then(response => response.text())
			.then(html => {
				jsdom.env({
					html: html,
					done: (err, context) => {
						if(err) reject(err);
						resolve(context);
					}
				});
			}).catch(reject);
		});
	}
 
	function countryScoreboardUrl (country, page, mode)
	{
		mode = mode || OSU_GAMEMODES.STD;
		// increment the page by one so we can have zero-indexed pages
		return util.format(OSU_COUNTRY_SCOREBOARD_URL, mode, country, page + 1);
	}

	function getUserApiUrl (user, mode)
	{
		mode = mode || OSU_GAMEMODES.STD;
		return util.format(OSU_API_GET_USER, apiKey, user, mode);
	}

	function getCountryScoreboard (country, page, mode)
	{
		mode = mode || OSU_GAMEMODES.STD;
		let url = countryScoreboardUrl(country, page, mode);
		
		return getDomContext(url).then(context => {
			let rows = context.document.querySelectorAll('.beatmapListing tr[onclick]');
			let ids = [];

			_.each(rows, row => {
				let matches = row.getAttribute('onclick').match(/document.location=\"\/u\/(\d+)\"/);
				ids.push(parseInt(matches[1]));
			});

			context.close();
			return ids;
		});
	}

	var userRequestHistory = [];

	function getProfile (id, mode, apiOnly)
	{
		mode = mode || OSU_GAMEMODES.STD;
		apiOnly = typeof apiOnly == 'undefined' ? true : apiOnly;

		var now = new Date();
		if (userRequestHistory.length > OSU_USER_API_REQUEST_RATE_N) {

			// check if the oldest timestamps is older than one minute
			if(moment(userRequestHistory[0]).add(OSU_USER_API_REQUEST_RATE_TIME, 's').isBefore(now)) {
				// filter out the timestamps older than one minute and continue as usual.
				userRequestHistory = userRequestHistory.filter(ts => moment(ts).add(OSU_USER_API_REQUEST_RATE_TIME, 's').isBefore(now));
			} else {
				// throttle the request.
				return delay(now.getTime() - userRequestHistory[0].getTime())
					.then(() => getProfile(id, mode, apiOnly));
			}
		}
		userRequestHistory.push(now);
		return fetch(getUserApiUrl(id, mode)).then(response => response.json());
	}

	function getBeatmap (id)
	{

	}

	return {
		getCountryScoreboard: getCountryScoreboard,
		getProfile: getProfile,
		getBeatmap: getBeatmap
	};
};