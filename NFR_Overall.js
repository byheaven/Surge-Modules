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
    
    if (typeof obj.paths[0][1] == "string") {
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
        if (video.details) {
            if (type == "movie") {
                year = video.details.releaseYear;
            }
            delete video.details;
        }
        
        const requestRatings = async () => {
            const IMDb = await requestIMDbRating(title, year, type);
            const Douban = await requestDoubanRating(IMDb.id);
            const IMDbrating = IMDb.msg.rating;
            const tomatoes = IMDb.msg.tomatoes;
            const awards = IMDb.msg.awards;
            const doubanRating = Douban.rating;
            const message = `${awards.length > 0 ? awards + "\n" + "\n": ""}${IMDbrating.length > 0 ? IMDbrating: ""}${doubanRating.length > 0 ? "\t" + "|" + "\t" + doubanRating: ""}`;
            return message;
        }

        let msg = "";
        requestRatings()
            .then(message => msg = message)
            .catch(error => msg = error + "\n")
            .finally(() => {
                let summary = obj.value.videos[videoID].summary;
                summary["supplementalMessage"] = `${msg}${summary && summary.supplementalMessage ? "\n" + summary.supplementalMessage : ""}`;
                msg_obj = {"tagline":summary.supplementalMessage, "classification":"REGULAR"}
                if (summary["supplementalMessages"]) {
                    summary["supplementalMessages"].push(msg_obj)
                }else {
                    summary["supplementalMessages"] = [msg_obj]
                }
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
        const url = `https://www.douban.com/search?cat=1002&q=${imdbId}`;
        if (consoleLog) console.log("Netflix Douban Rating URL:\n" + url);
        $tool.get(url, function (error, response, data) {
            if (!error) {
                if (consoleLog) console.log("Netflix Douban Rating Data:\n" + data);
                if (response.status == 200) {
                    const rating = get_douban_rating_message(data);
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
    
    const ratings = data.Ratings || [];
    const imdbSource = ratings[0]?.Source;

    if (!imdbSource || imdbSource !== "Internet Movie Database") {
        return { rating: "", tomatoes: "", awards: "" };
    }

    const imdbRating = ratings[0]?.Value;
    const rating_message = imdbRating ? `[IMDb] ★${imdbRating}` : "";

    let tomatoes_message = "";

    if (data.Type === "movie" && ratings.length > 1) {
        const rtIndex = ratings.findIndex(rating => rating.Source === "Rotten Tomatoes");
        tomatoes_message = rtIndex !== -1 ? `[RT] ★${ratings[rtIndex].Value}` : "";
    }

    awards_message = data.Awards ? "🏆" + data.Awards : "";

    return { rating: rating_message, tomatoes: tomatoes_message, awards: awards_message };
}

function get_douban_rating_message(data) {
    const s = data.replace(/\n| |&#\d{2}/g, '')
        .match(/\[(\u7535\u5f71|\u7535\u89c6\u5267)\].+?subject-cast\">.+?<\/span>/g);
    const average = s ? s[0].split(/">(\d\.\d)</)[1] || '' : '';

    if (!average) {
        return '';
    }

    const rating_message = `[Douban] ★${average}/10`;
    return rating_message;
}

function errorTip() {
    return { noData: "", error: "" }
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
