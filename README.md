# Yet Another Movies/TV Series Rating Scripts For Netflix iOS APP
These scripts will indicate rating scores from IMDB/Douban/Rotten Tomatoes on Netflix iOS, contained with two features: Overall Rating & Per Episode Rating.
[Notice] Few scores may be missing due to inapplicable data, outdated cookies or invalid api.

Display netflix ratings（IMDb、douaban）
```properties
[Script]
http-request ^https?://ios\.prod\.ftl\.netflix\.com/iosui/user/.+path=%5B%22videos%22%2C%\d+%22%2C%22summary%22%5D script-path=https://raw.githubusercontent.com/yichahucha/surge/master/nf_rating.js
http-response ^https?://ios\.prod\.ftl\.netflix\.com/iosui/user/.+path=%5B%22videos%22%2C%\d+%22%2C%22summary%22%5D requires-body=1,script-path=https://raw.githubusercontent.com/yichahucha/surge/master/nf_rating.js
# 单集评分
nf_rating_season.js = type=http-response,pattern=^https?://ios\.prod\.ftl\.netflix\.com/iosui/warmer/.+type=show-ath,requires-body=1,max-size=0,script-path=https://raw.githubusercontent.com/yichahucha/surge/master/nf_rating_season.js
[MITM]
hostname = ios.prod.ftl.netflix.com
```
