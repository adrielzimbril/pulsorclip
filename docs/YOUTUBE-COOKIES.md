# YouTube Cookies

Some YouTube requests now fail with an error similar to:

`Sign in to confirm you're not a bot`

PulsorClip supports three ways to pass cookies into `yt-dlp`.

## Option 1: Browser cookies

Use:

`YTDLP_COOKIES_FROM_BROWSER=chrome`

Examples:

- `chrome`
- `edge`
- `firefox`
- `brave`

This is best for local development on your own machine.

## Option 2: Cookies file on disk

Use:

`YTDLP_COOKIES_FILE=/absolute/path/to/cookies.txt`

The file should be in Netscape cookie format.

## Option 3: Base64 cookies payload

Use:

`YTDLP_COOKIES_BASE64=<base64-encoded-cookies.txt>`

This is usually the most practical hosted option because you can store it as an environment variable.

## Recommendation

- local machine: `YTDLP_COOKIES_FROM_BROWSER`
- hosted environment: `YTDLP_COOKIES_BASE64`
