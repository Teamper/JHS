# BTSOW samples

Protocol checked through the Chrome extension on 2026-10-03:
`https://btsow.icu/` links to `https://bt1.btsow.me/`, which embeds
`https://so2.btsow.top/`. Its own search UI sends a GET request to
`/search?key=ubuntu&ap=1` and receives HTML with status 200.

`btsow-empty.html` is a reduced structural copy of that response. It contains
no user data, scripts, styling assets or result content.

`btsow-results.html` is a synthetic parser sample. The current site's
`/static/js/common.min.js?v=1.12` references `.card2`, `/hash/` resource links
and `.clipboard` buttons whose `title` contains the magnet URI. Live searches
returned no cards, so nonempty result markup remains unverified online.
