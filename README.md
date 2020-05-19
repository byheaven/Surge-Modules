# Yet Another Movies/TV Series Rating Scripts For Netflix iOS APP

These scripts will indicate the rating scores from *[IMDB](https://www.imdb.com/)/[Douban](https://movie.douban.com)/[Rotten Tomatoes](https://www.rottentomatoes.com/)* on Netflix iOS, contained with two features: Overall Rating & Per Episode Rating.

This version is a modification of Yichahucha's brilliant work: https://github.com/yichahucha/surge/tree/master, I made some minimal layout and brought back 🇹🇼 flag but the else are the same.

🚨 Some scores may be missing due to inapplicable data, outdated cookies or invalid api.

## Load'em in your *[Surge](https://community.nssurge.com/d/33-scripting)/[Quantumult X](https://github.com/crossutility/Quantumult-X/blob/master/sample.conf)* or build a Surge Module yourselves:
```properties
#!name=Rating Scores for Netflix
#!desc=Indicates overall rating & per episode rating scores on Netflix
#!system=ios

[Replica]
keyword-filter-type = blacklist
keyword-filter = %INSERT% ios.prod.ftl.netflix.com

[MITM]
hostname = %APPEND% ios.prod.ftl.netflix.com

[Script]
Netflix = type=http-request,pattern=^https?://ios\.prod\.ftl\.netflix\.com/iosui/user/.+path=%5B%22videos%22%2C%\d+%22%2C%22summary%22%5D,script-path=https://raw.githubusercontent.com/TPCTPCTPC/Yet-Another-Rating-Score-Script/master/NFR_Overall.js
Netflix = type=http-response,pattern=^https?://ios\.prod\.ftl\.netflix\.com/iosui/user/.+path=%5B%22videos%22%2C%\d+%22%2C%22summary%22%5D,requires-body=1,max-size=0,script-path=https://raw.githubusercontent.com/TPCTPCTPC/Yet-Another-Rating-Score-Script/master/NFR_Overall.js
Episodes = type=http-response,pattern=^https?://ios\.prod\.ftl\.netflix\.com/iosui/warmer/.+type=show-ath,requires-body=1,max-size=0,script-path=https://raw.githubusercontent.com/TPCTPCTPC/Yet-Another-Rating-Score-Script/master/NFR_perEpisode.js
```

## Samples:
![test image size](https://raw.githubusercontent.com/TPCTPCTPC/Yet-Another-Rating-Score-Script/master/Display%20Samples/TV_Series.jpg "TV Series")
![test image size](https://raw.githubusercontent.com/TPCTPCTPC/Yet-Another-Rating-Score-Script/master/Display%20Samples/Movies.jpg "Movies")
