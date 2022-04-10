/*
READMEï¼šhttps://github.com/yichahucha/surge/tree/master
 */

const $tool = new Tool()
const consoleLog = false;
const imdbApikeyCacheKey = "ImdbApikeyCacheKey";
const netflixTitleCacheKey = "NetflixTitleCacheKey";

if (!$tool.isResponse) {
    let url = $request.url;
    const urlDecode = decodeURIComponent(url);
    const videos = urlDecode.match(/"videos","(\d+)"/);
    const videoID = videos[1];
    const map = getTitleMap();
    const title = map[videoID];
    const isEnglish = url.match(/languages=en/) ? true : false;
    if (!title && !isEnglish) {
        const currentSummary = urlDecode.match(/\["videos","(\d+)","current","summary"\]/);
        if (currentSummary) {
            url = url.replace("&path=" + encodeURIComponent(currentSummary[0]), "");
        }
        url = url.replace(/&languages=(.*?)&/, "&languages=en-US&");
    }
    url += "&path=" + encodeURIComponent(`[${videos[0]},"details"]`);
    $done({ url });
} else {
    var IMDbApikeys = IMDbApikeys();
    var IMDbApikey = $tool.read(imdbApikeyCacheKey);
    if (!IMDbApikey) updateIMDbApikey();
    let obj = JSON.parse($response.body);
    if (consoleLog) console.log("Netflix Original Body:\n" + $response.body);
    if (typeof(obj.paths[0][1]) == "string") {
    const videoID = obj.paths[0][1];
    const video = obj.value.videos[videoID];
    const map = getTitleMap();
    let title = map[videoID];
    if (!title) {
        title = video.summary.title;
        setTitleMap(videoID, title, map);
    }
    let year = null;
    let type = video.summary.type;
    if (type == "show") {
        type = "series";
    }
    if (type == "movie") {
        year = video.details.releaseYear;
    }
    delete video.details;
    const requestRatings = async () => {
        const IMDb = await requestIMDbRating(title, year, type);
        const Douban = await requestDoubanRating(IMDb.id);
        const IMDbrating = IMDb.msg.rating;
        const tomatoes = IMDb.msg.tomatoes;
        const country = IMDb.msg.country;
        const doubanRating = Douban.rating;
        const message = `${country}\n${IMDbrating}\n${doubanRating}${tomatoes.length > 0 ? "\n" + tomatoes + "\n" : "\n"}`;
        return message;
    }
    let msg = "";
    requestRatings()
        .then(message => msg = message)
        .catch(error => msg = error + "\n")
        .finally(() => {
            let summary = obj.value.videos[videoID].summary;
            summary["supplementalMessage"] = `${msg}${summary && summary.supplementalMessage ? "\n" + summary.supplementalMessage : ""}`;
            if (consoleLog) console.log("Netflix Modified Body:\n" + JSON.stringify(obj));
            $done({ body: JSON.stringify(obj) });
        });
    } else {
        $done({});
    }
}

function getTitleMap() {
    const map = $tool.read(netflixTitleCacheKey);
    return map ? JSON.parse(map) : {};
}

function setTitleMap(id, title, map) {
    map[id] = title;
    $tool.write(JSON.stringify(map), netflixTitleCacheKey);
}

function requestDoubanRating(imdbId) {
    return new Promise(function (resolve, reject) {
        const url = "https://api.douban.com/v2/movie/imdb/" + imdbId + "?apikey=0df993c66c0c636e29ecbb5344252a4a";
        if (consoleLog) console.log("Netflix Douban Rating URL:\n" + url);
        $tool.get(url, function (error, response, data) {
            if (!error) {
                if (consoleLog) console.log("Netflix Douban Rating Data:\n" + data);
                if (response.status == 200) {
                    const obj = JSON.parse(data);
                    const rating = get_douban_rating_message(obj);
                    resolve({ rating });
                } else {
                    resolve({ rating: "Douban:  " + errorTip().noData });
                }
            } else {
                if (consoleLog) console.log("Netflix Douban Rating Error:\n" + error);
                resolve({ rating: "Douban:  " + errorTip().error });
            }
        });
    });
}

function requestIMDbRating(title, year, type) {
    return new Promise(function (resolve, reject) {
        let url = "https://www.omdbapi.com/?t=" + encodeURI(title) + "&apikey=" + IMDbApikey;
        if (year) url += "&y=" + year;
        if (type) url += "&type=" + type;
        if (consoleLog) console.log("Netflix IMDb Rating URL:\n" + url);
        $tool.get(url, function (error, response, data) {
            if (!error) {
                if (consoleLog) console.log("Netflix IMDb Rating Data:\n" + data);
                if (response.status == 200) {
                    const obj = JSON.parse(data);
                    if (obj.Response != "False") {
                        const id = obj.imdbID;
                        const msg = get_IMDb_message(obj);
                        resolve({ id, msg });
                    } else {
                        reject(errorTip().noData);
                    }
                } else if (response.status == 401) {
                    if (IMDbApikeys.length > 1) {
                        updateIMDbApikey();
                        requestIMDbRating(title, year, type);
                    } else {
                        reject(errorTip().noData);
                    }
                } else {
                    reject(errorTip().noData);
                }
            } else {
                if (consoleLog) console.log("Netflix IMDb Rating Error:\n" + error);
                reject(errorTip().error);
            }
        });
    });
}

function updateIMDbApikey() {
    if (IMDbApikey) IMDbApikeys.splice(IMDbApikeys.indexOf(IMDbApikey), 1);
    const index = Math.floor(Math.random() * IMDbApikeys.length);
    IMDbApikey = IMDbApikeys[index];
    $tool.write(IMDbApikey, imdbApikeyCacheKey);
}

function get_IMDb_message(data) {
    let rating_message = "IMDb:  â­ï¸ N/A";
    let tomatoes_message = "";
    let country_message = "";
    let ratings = data.Ratings;
    if (ratings.length > 0) {
        const imdb_source = ratings[0]["Source"];
        if (imdb_source == "Internet Movie Database") {
            const imdb_votes = data.imdbVotes;
            const imdb_rating = ratings[0]["Value"];
            rating_message = "IMDb:  â­ï¸ " + imdb_rating + "   " + imdb_votes;
            if (data.Type == "movie") {
                if (ratings.length > 1) {
                    const source = ratings[1]["Source"];
                    if (source == "Rotten Tomatoes") {
                        const tomatoes = ratings[1]["Value"];
                        tomatoes_message = "Tomatoes:  ðŸ… " + tomatoes;
                    }
                }
            }
        }
    }
    country_message = get_country_message(data.Country);
    return { rating: rating_message, tomatoes: tomatoes_message, country: country_message }
}

function get_douban_rating_message(data) {
    const average = data.rating.average;
    const numRaters = data.rating.numRaters;
    const rating_message = `Douban:  â­ï¸ ${average.length > 0 ? average + "/10" : "N/A"}   ${numRaters == 0 ? "" : parseFloat(numRaters).toLocaleString()}`;
    return rating_message;
}

function get_country_message(data) {
    const country = data;
    const countrys = country.split(", ");
    let emoji_country = "";
    countrys.forEach(item => {
        emoji_country += countryEmoji(item) + " " + item + ", ";
    });
    return emoji_country.slice(0, -2);
}

function errorTip() {
    return { noData: "â­ï¸ N/A", error: "âŒ N/A" }
}

function IMDbApikeys() {
    const apikeys = [
        "f75e0253", "d8bb2d6b",
        "ae64ce8d", "7218d678",
        "b2650e38", "8c4a29ab",
        "9bd135c2", "953dbabe",
        "1a66ef12", "3e7ea721",
        "457fc4ff", "d2131426",
        "9cc1a9b7", "e53c2c11",
        "f6dfce0e", "b9db622f",
        "e6bde2b9", "d324dbab",
        "d7904fa3", "aeaf88b9",
        "4e89234e",];
    return apikeys;
}

function countryEmoji(name) {
    const emojiMap = {
        "Chequered": "ðŸ",
        "Triangular": "ðŸš©",
        "Crossed": "ðŸŽŒ",
        "Black": "ðŸ´",
        "White": "ðŸ³",
        "Rainbow": "ðŸ³ï¸â€ðŸŒˆ",
        "Pirate": "ðŸ´â€â˜ ï¸",
        "Ascension Island": "ðŸ‡¦ðŸ‡¨",
        "Andorra": "ðŸ‡¦ðŸ‡©",
        "United Arab Emirates": "ðŸ‡¦ðŸ‡ª",
        "Afghanistan": "ðŸ‡¦ðŸ‡«",
        "Antigua & Barbuda": "ðŸ‡¦ðŸ‡¬",
        "Anguilla": "ðŸ‡¦ðŸ‡®",
        "Albania": "ðŸ‡¦ðŸ‡±",
        "Armenia": "ðŸ‡¦ðŸ‡²",
        "Angola": "ðŸ‡¦ðŸ‡´",
        "Antarctica": "ðŸ‡¦ðŸ‡¶",
        "Argentina": "ðŸ‡¦ðŸ‡·",
        "American Samoa": "ðŸ‡¦ðŸ‡¸",
        "Austria": "ðŸ‡¦ðŸ‡¹",
        "Australia": "ðŸ‡¦ðŸ‡º",
        "Aruba": "ðŸ‡¦ðŸ‡¼",
        "Ã…land Islands": "ðŸ‡¦ðŸ‡½",
        "Azerbaijan": "ðŸ‡¦ðŸ‡¿",
        "Bosnia & Herzegovina": "ðŸ‡§ðŸ‡¦",
        "Barbados": "ðŸ‡§ðŸ‡§",
        "Bangladesh": "ðŸ‡§ðŸ‡©",
        "Belgium": "ðŸ‡§ðŸ‡ª",
        "Burkina Faso": "ðŸ‡§ðŸ‡«",
        "Bulgaria": "ðŸ‡§ðŸ‡¬",
        "Bahrain": "ðŸ‡§ðŸ‡­",
        "Burundi": "ðŸ‡§ðŸ‡®",
        "Benin": "ðŸ‡§ðŸ‡¯",
        "St. BarthÃ©lemy": "ðŸ‡§ðŸ‡±",
        "Bermuda": "ðŸ‡§ðŸ‡²",
        "Brunei": "ðŸ‡§ðŸ‡³",
        "Bolivia": "ðŸ‡§ðŸ‡´",
        "Caribbean Netherlands": "ðŸ‡§ðŸ‡¶",
        "Brazil": "ðŸ‡§ðŸ‡·",
        "Bahamas": "ðŸ‡§ðŸ‡¸",
        "Bhutan": "ðŸ‡§ðŸ‡¹",
        "Bouvet Island": "ðŸ‡§ðŸ‡»",
        "Botswana": "ðŸ‡§ðŸ‡¼",
        "Belarus": "ðŸ‡§ðŸ‡¾",
        "Belize": "ðŸ‡§ðŸ‡¿",
        "Canada": "ðŸ‡¨ðŸ‡¦",
        "Cocos (Keeling) Islands": "ðŸ‡¨ðŸ‡¨",
        "Congo - Kinshasa": "ðŸ‡¨ðŸ‡©",
        "Congo": "ðŸ‡¨ðŸ‡©",
        "Central African Republic": "ðŸ‡¨ðŸ‡«",
        "Congo - Brazzaville": "ðŸ‡¨ðŸ‡¬",
        "Switzerland": "ðŸ‡¨ðŸ‡­",
        "CÃ´te dâ€™Ivoire": "ðŸ‡¨ðŸ‡®",
        "Cook Islands": "ðŸ‡¨ðŸ‡°",
        "Chile": "ðŸ‡¨ðŸ‡±",
        "Cameroon": "ðŸ‡¨ðŸ‡²",
        "China": "ðŸ‡¨ðŸ‡³",
        "Colombia": "ðŸ‡¨ðŸ‡´",
        "Clipperton Island": "ðŸ‡¨ðŸ‡µ",
        "Costa Rica": "ðŸ‡¨ðŸ‡·",
        "Cuba": "ðŸ‡¨ðŸ‡º",
        "Cape Verde": "ðŸ‡¨ðŸ‡»",
        "CuraÃ§ao": "ðŸ‡¨ðŸ‡¼",
        "Christmas Island": "ðŸ‡¨ðŸ‡½",
        "Cyprus": "ðŸ‡¨ðŸ‡¾",
        "Czechia": "ðŸ‡¨ðŸ‡¿",
        "Czech Republic": "ðŸ‡¨ðŸ‡¿",
        "Germany": "ðŸ‡©ðŸ‡ª",
        "Diego Garcia": "ðŸ‡©ðŸ‡¬",
        "Djibouti": "ðŸ‡©ðŸ‡¯",
        "Denmark": "ðŸ‡©ðŸ‡°",
        "Dominica": "ðŸ‡©ðŸ‡²",
        "Dominican Republic": "ðŸ‡©ðŸ‡´",
        "Algeria": "ðŸ‡©ðŸ‡¿",
        "Ceuta & Melilla": "ðŸ‡ªðŸ‡¦",
        "Ecuador": "ðŸ‡ªðŸ‡¨",
        "Estonia": "ðŸ‡ªðŸ‡ª",
        "Egypt": "ðŸ‡ªðŸ‡¬",
        "Western Sahara": "ðŸ‡ªðŸ‡­",
        "Eritrea": "ðŸ‡ªðŸ‡·",
        "Spain": "ðŸ‡ªðŸ‡¸",
        "Ethiopia": "ðŸ‡ªðŸ‡¹",
        "European Union": "ðŸ‡ªðŸ‡º",
        "Finland": "ðŸ‡«ðŸ‡®",
        "Fiji": "ðŸ‡«ðŸ‡¯",
        "Falkland Islands": "ðŸ‡«ðŸ‡°",
        "Micronesia": "ðŸ‡«ðŸ‡²",
        "Faroe Islands": "ðŸ‡«ðŸ‡´",
        "France": "ðŸ‡«ðŸ‡·",
        "Gabon": "ðŸ‡¬ðŸ‡¦",
        "United Kingdom": "ðŸ‡¬ðŸ‡§",
        "UK": "ðŸ‡¬ðŸ‡§",
        "Grenada": "ðŸ‡¬ðŸ‡©",
        "Georgia": "ðŸ‡¬ðŸ‡ª",
        "French Guiana": "ðŸ‡¬ðŸ‡«",
        "Guernsey": "ðŸ‡¬ðŸ‡¬",
        "Ghana": "ðŸ‡¬ðŸ‡­",
        "Gibraltar": "ðŸ‡¬ðŸ‡®",
        "Greenland": "ðŸ‡¬ðŸ‡±",
        "Gambia": "ðŸ‡¬ðŸ‡²",
        "Guinea": "ðŸ‡¬ðŸ‡³",
        "Guadeloupe": "ðŸ‡¬ðŸ‡µ",
        "Equatorial Guinea": "ðŸ‡¬ðŸ‡¶",
        "Greece": "ðŸ‡¬ðŸ‡·",
        "South Georgia & South Sandwich Is lands": "ðŸ‡¬ðŸ‡¸",
        "Guatemala": "ðŸ‡¬ðŸ‡¹",
        "Guam": "ðŸ‡¬ðŸ‡º",
        "Guinea-Bissau": "ðŸ‡¬ðŸ‡¼",
        "Guyana": "ðŸ‡¬ðŸ‡¾",
        "Hong Kong SAR China": "ðŸ‡­ðŸ‡°",
        "Hong Kong": "ðŸ‡­ðŸ‡°",
        "Heard & McDonald Islands": "ðŸ‡­ðŸ‡²",
        "Honduras": "ðŸ‡­ðŸ‡³",
        "Croatia": "ðŸ‡­ðŸ‡·",
        "Haiti": "ðŸ‡­ðŸ‡¹",
        "Hungary": "ðŸ‡­ðŸ‡º",
        "Canary Islands": "ðŸ‡®ðŸ‡¨",
        "Indonesia": "ðŸ‡®ðŸ‡©",
        "Ireland": "ðŸ‡®ðŸ‡ª",
        "Israel": "ðŸ‡®ðŸ‡±",
        "Isle of Man": "ðŸ‡®ðŸ‡²",
        "India": "ðŸ‡®ðŸ‡³",
        "British Indian Ocean Territory": "ðŸ‡®ðŸ‡´",
        "Iraq": "ðŸ‡®ðŸ‡¶",
        "Iran": "ðŸ‡®ðŸ‡·",
        "Iceland": "ðŸ‡®ðŸ‡¸",
        "Italy": "ðŸ‡®ðŸ‡¹",
        "Jersey": "ðŸ‡¯ðŸ‡ª",
        "Jamaica": "ðŸ‡¯ðŸ‡²",
        "Jordan": "ðŸ‡¯ðŸ‡´",
        "Japan": "ðŸ‡¯ðŸ‡µ",
        "Kenya": "ðŸ‡°ðŸ‡ª",
        "Kyrgyzstan": "ðŸ‡°ðŸ‡¬",
        "Cambodia": "ðŸ‡°ðŸ‡­",
        "Kiribati": "ðŸ‡°ðŸ‡®",
        "Comoros": "ðŸ‡°ðŸ‡²",
        "St. Kitts & Nevis": "ðŸ‡°ðŸ‡³",
        "North Korea": "ðŸ‡°ðŸ‡µ",
        "South Korea": "ðŸ‡°ðŸ‡·",
        "Kuwait": "ðŸ‡°ðŸ‡¼",
        "Cayman Islands": "ðŸ‡°ðŸ‡¾",
        "Kazakhstan": "ðŸ‡°ðŸ‡¿",
        "Laos": "ðŸ‡±ðŸ‡¦",
        "Lebanon": "ðŸ‡±ðŸ‡§",
        "St. Lucia": "ðŸ‡±ðŸ‡¨",
        "Liechtenstein": "ðŸ‡±ðŸ‡®",
        "Sri Lanka": "ðŸ‡±ðŸ‡°",
        "Liberia": "ðŸ‡±ðŸ‡·",
        "Lesotho": "ðŸ‡±ðŸ‡¸",
        "Lithuania": "ðŸ‡±ðŸ‡¹",
        "Luxembourg": "ðŸ‡±ðŸ‡º",
        "Latvia": "ðŸ‡±ðŸ‡»",
        "Libya": "ðŸ‡±ðŸ‡¾",
        "Morocco": "ðŸ‡²ðŸ‡¦",
        "Monaco": "ðŸ‡²ðŸ‡¨",
        "Moldova": "ðŸ‡²ðŸ‡©",
        "Montenegro": "ðŸ‡²ðŸ‡ª",
        "St. Martin": "ðŸ‡²ðŸ‡«",
        "Madagascar": "ðŸ‡²ðŸ‡¬",
        "Marshall Islands": "ðŸ‡²ðŸ‡­",
        "North Macedonia": "ðŸ‡²ðŸ‡°",
        "Mali": "ðŸ‡²ðŸ‡±",
        "Myanmar (Burma)": "ðŸ‡²ðŸ‡²",
        "Mongolia": "ðŸ‡²ðŸ‡³",
        "Macau Sar China": "ðŸ‡²ðŸ‡´",
        "Northern Mariana Islands": "ðŸ‡²ðŸ‡µ",
        "Martinique": "ðŸ‡²ðŸ‡¶",
        "Mauritania": "ðŸ‡²ðŸ‡·",
        "Montserrat": "ðŸ‡²ðŸ‡¸",
        "Malta": "ðŸ‡²ðŸ‡¹",
        "Mauritius": "ðŸ‡²ðŸ‡º",
        "Maldives": "ðŸ‡²ðŸ‡»",
        "Malawi": "ðŸ‡²ðŸ‡¼",
        "Mexico": "ðŸ‡²ðŸ‡½",
        "Malaysia": "ðŸ‡²ðŸ‡¾",
        "Mozambique": "ðŸ‡²ðŸ‡¿",
        "Namibia": "ðŸ‡³ðŸ‡¦",
        "New Caledonia": "ðŸ‡³ðŸ‡¨",
        "Niger": "ðŸ‡³ðŸ‡ª",
        "Norfolk Island": "ðŸ‡³ðŸ‡«",
        "Nigeria": "ðŸ‡³ðŸ‡¬",
        "Nicaragua": "ðŸ‡³ðŸ‡®",
        "Netherlands": "ðŸ‡³ðŸ‡±",
        "Norway": "ðŸ‡³ðŸ‡´",
        "Nepal": "ðŸ‡³ðŸ‡µ",
        "Nauru": "ðŸ‡³ðŸ‡·",
        "Niue": "ðŸ‡³ðŸ‡º",
        "New Zealand": "ðŸ‡³ðŸ‡¿",
        "Oman": "ðŸ‡´ðŸ‡²",
        "Panama": "ðŸ‡µðŸ‡¦",
        "Peru": "ðŸ‡µðŸ‡ª",
        "French Polynesia": "ðŸ‡µðŸ‡«",
        "Papua New Guinea": "ðŸ‡µðŸ‡¬",
        "Philippines": "ðŸ‡µðŸ‡­",
        "Pakistan": "ðŸ‡µðŸ‡°",
        "Poland": "ðŸ‡µðŸ‡±",
        "St. Pierre & Miquelon": "ðŸ‡µðŸ‡²",
        "Pitcairn Islands": "ðŸ‡µðŸ‡³",
        "Puerto Rico": "ðŸ‡µðŸ‡·",
        "Palestinian Territories": "ðŸ‡µðŸ‡¸",
        "Portugal": "ðŸ‡µðŸ‡¹",
        "Palau": "ðŸ‡µðŸ‡¼",
        "Paraguay": "ðŸ‡µðŸ‡¾",
        "Qatar": "ðŸ‡¶ðŸ‡¦",
        "RÃ©union": "ðŸ‡·ðŸ‡ª",
        "Romania": "ðŸ‡·ðŸ‡´",
        "Serbia": "ðŸ‡·ðŸ‡¸",
        "Russia": "ðŸ‡·ðŸ‡º",
        "Rwanda": "ðŸ‡·ðŸ‡¼",
        "Saudi Arabia": "ðŸ‡¸ðŸ‡¦",
        "Solomon Islands": "ðŸ‡¸ðŸ‡§",
        "Seychelles": "ðŸ‡¸ðŸ‡¨",
        "Sudan": "ðŸ‡¸ðŸ‡©",
        "Sweden": "ðŸ‡¸ðŸ‡ª",
        "Singapore": "ðŸ‡¸ðŸ‡¬",
        "St. Helena": "ðŸ‡¸ðŸ‡­",
        "Slovenia": "ðŸ‡¸ðŸ‡®",
        "Svalbard & Jan Mayen": "ðŸ‡¸ðŸ‡¯",
        "Slovakia": "ðŸ‡¸ðŸ‡°",
        "Sierra Leone": "ðŸ‡¸ðŸ‡±",
        "San Marino": "ðŸ‡¸ðŸ‡²",
        "Senegal": "ðŸ‡¸ðŸ‡³",
        "Somalia": "ðŸ‡¸ðŸ‡´",
        "Suriname": "ðŸ‡¸ðŸ‡·",
        "South Sudan": "ðŸ‡¸ðŸ‡¸",
        "SÃ£o TomÃ© & PrÃ­ncipe": "ðŸ‡¸ðŸ‡¹",
        "El Salvador": "ðŸ‡¸ðŸ‡»",
        "Sint Maarten": "ðŸ‡¸ðŸ‡½",
        "Syria": "ðŸ‡¸ðŸ‡¾",
        "Swaziland": "ðŸ‡¸ðŸ‡¿",
        "Tristan Da Cunha": "ðŸ‡¹ðŸ‡¦",
        "Turks & Caicos Islands": "ðŸ‡¹ðŸ‡¨",
        "Chad": "ðŸ‡¹ðŸ‡©",
        "French Southern Territories": "ðŸ‡¹ðŸ‡«",
        "Togo": "ðŸ‡¹ðŸ‡¬",
        "Thailand": "ðŸ‡¹ðŸ‡­",
        "Tajikistan": "ðŸ‡¹ðŸ‡¯",
        "Tokelau": "ðŸ‡¹ðŸ‡°",
        "Timor-Leste": "ðŸ‡¹ðŸ‡±",
        "Turkmenistan": "ðŸ‡¹ðŸ‡²",
        "Tunisia": "ðŸ‡¹ðŸ‡³",
        "Tonga": "ðŸ‡¹ðŸ‡´",
        "Turkey": "ðŸ‡¹ðŸ‡·",
        "Trinidad & Tobago": "ðŸ‡¹ðŸ‡¹",
        "Tuvalu": "ðŸ‡¹ðŸ‡»",
        "Taiwan": "ðŸ‡¹ðŸ‡¼",
        "Tanzania": "ðŸ‡¹ðŸ‡¿",
        "Ukraine": "ðŸ‡ºðŸ‡¦",
        "Uganda": "ðŸ‡ºðŸ‡¬",
        "U.S. Outlying Islands": "ðŸ‡ºðŸ‡²",
        "United Nations": "ðŸ‡ºðŸ‡³",
        "United States": "ðŸ‡ºðŸ‡¸",
        "USA": "ðŸ‡ºðŸ‡¸",
        "Uruguay": "ðŸ‡ºðŸ‡¾",
        "Uzbekistan": "ðŸ‡ºðŸ‡¿",
        "Vatican City": "ðŸ‡»ðŸ‡¦",
        "St. Vincent & Grenadines": "ðŸ‡»ðŸ‡¨",
        "Venezuela": "ðŸ‡»ðŸ‡ª",
        "British Virgin Islands": "ðŸ‡»ðŸ‡¬",
        "U.S. Virgin Islands": "ðŸ‡»ðŸ‡®",
        "Vietnam": "ðŸ‡»ðŸ‡³",
        "Vanuatu": "ðŸ‡»ðŸ‡º",
        "Wallis & Futuna": "ðŸ‡¼ðŸ‡«",
        "Samoa": "ðŸ‡¼ðŸ‡¸",
        "Kosovo": "ðŸ‡½ðŸ‡°",
        "Yemen": "ðŸ‡¾ðŸ‡ª",
        "Mayotte": "ðŸ‡¾ðŸ‡¹",
        "South Africa": "ðŸ‡¿ðŸ‡¦",
        "Zambia": "ðŸ‡¿ðŸ‡²",
        "Zimbabwe": "ðŸ‡¿ðŸ‡¼",
        "England": "ðŸ´ó §ó ¢ó ¥ó ®ó §ó ¿",
        "Scotland": "ðŸ´ó §ó ¢ó ³ó £ó ´ó ¿",
        "Wales": "ðŸ´ó §ó ¢ó ·ó ¬ó ³ó ¿",
    }
    return emojiMap[name] ? emojiMap[name] : emojiMap["Chequered"];
}

function Tool() {
    _node = (() => {
        if (typeof require == "function") {
            const request = require('request')
            return ({ request })
        } else {
            return (null)
        }
    })()
    _isSurge = typeof $httpClient != "undefined"
    _isQuanX = typeof $task != "undefined"
    this.isSurge = _isSurge
    this.isQuanX = _isQuanX
    this.isResponse = typeof $response != "undefined"
    this.notify = (title, subtitle, message) => {
        if (_isQuanX) $notify(title, subtitle, message)
        if (_isSurge) $notification.post(title, subtitle, message)
        if (_node) console.log(JSON.stringify({ title, subtitle, message }));
    }
    this.write = (value, key) => {
        if (_isQuanX) return $prefs.setValueForKey(value, key)
        if (_isSurge) return $persistentStore.write(value, key)
    }
    this.read = (key) => {
        if (_isQuanX) return $prefs.valueForKey(key)
        if (_isSurge) return $persistentStore.read(key)
    }
    this.get = (options, callback) => {
        if (_isQuanX) {
            if (typeof options == "string") options = { url: options }
            options["method"] = "GET"
            $task.fetch(options).then(response => { callback(null, _status(response), response.body) }, reason => callback(reason.error, null, null))
        }
        if (_isSurge) $httpClient.get(options, (error, response, body) => { callback(error, _status(response), body) })
        if (_node) _node.request(options, (error, response, body) => { callback(error, _status(response), body) })
    }
    this.post = (options, callback) => {
        if (_isQuanX) {
            if (typeof options == "string") options = { url: options }
            options["method"] = "POST"
            $task.fetch(options).then(response => { callback(null, _status(response), response.body) }, reason => callback(reason.error, null, null))
        }
        if (_isSurge) $httpClient.post(options, (error, response, body) => { callback(error, _status(response), body) })
        if (_node) _node.request.post(options, (error, response, body) => { callback(error, _status(response), body) })
    }
    _status = (response) => {
        if (response) {
            if (response.status) {
                response["statusCode"] = response.status
            } else if (response.statusCode) {
                response["status"] = response.statusCode
            }
        }
        return response
    }
}
