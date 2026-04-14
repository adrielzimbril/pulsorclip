# YouTube Cookies

Some YouTube requests now fail with an error similar to:

`Sign in to confirm you're not a bot`

PulsorClip supports four ways to pass cookies into `yt-dlp`.

## Option 1: Telegram Command (Recommended for VPS)

Admins can update cookies directly via the Telegram bot:

```
/cookies <paste cookies.txt content here>
```

**Steps:**

1. Install a browser extension like "Get cookies.txt" or "Cookie-Editor" on Chrome/Firefox
2. Log into YouTube on your PC
3. Export/Download the cookies in Netscape format (creates `cookies.txt`)
4. Open the file in a text editor and copy all content
5. In Telegram: `/cookies` then paste the content

**Benefits:**

- Works on VPS without file access
- Cookies are shared between bot and web downloads
- Stored in metadata system (persistent across restarts)
- Easy to update without redeploying

## Option 2: Browser cookies

Use:

`YTDLP_COOKIES_FROM_BROWSER=chrome`

Examples:

- `chrome`
- `edge`
- `firefox`
- `brave`

This is best for local development on your own machine.

## Option 3: Cookies file on disk

Use:

`YTDLP_COOKIES_FILE=/absolute/path/to/cookies.txt`

The file should be in Netscape cookie format.

## Option 4: Base64 cookies payload

Use:

`YTDLP_COOKIES_BASE64=<base64-encoded-cookies.txt>`

This is usually the most practical hosted option because you can store it as an environment variable.

**To generate base64:**

```bash
npm run encode-cookies ./cookies.txt
```

This script encodes your cookies.txt to base64 and logs the value for the environment variable.

## Recommendation

- **VPS/Cloud**: Use `/cookies` Telegram command (easiest)
- **Local dev**: `YTDLP_COOKIES_FROM_BROWSER`
- **Manual setup**: `YTDLP_COOKIES_BASE64` with encode script
