# Yet Another Movies/TV Series Rating Scripts For Netflix iOS APP
These scripts will indicate rating scores from IMDB/Douban/Rotten Tomatoes on Netflix iOS, contained with two features: Overall Rating & Per Episode Rating.

[Notice] Few scores may be missing due to inapplicable data, outdated cookies or invalid api.

## Samples:
![test image size](url){:height="50%" width="50%"}
![test image size](https://raw.githubusercontent.com/TPCTPCTPC/Yet-Another-Rating-Score-Script/master/Display%20Samples/TV_Series.jpg "TV Series"){:height="50%" width="50%"}
![test image size](https://raw.githubusercontent.com/TPCTPCTPC/Yet-Another-Rating-Score-Script/master/Display%20Samples/Movies.jpg "Movies"){:height="50%" width="50%"}


## Load'em in your Surge/Quantumult X/Loon or build a Surge Module yourselves:
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
