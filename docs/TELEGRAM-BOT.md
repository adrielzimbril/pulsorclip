# PulsorClip Telegram Bot

This document centralizes the Telegram bot copy, BotFather metadata, onboarding text, and UX rules used by PulsorClip.

## Purpose

The bot is not a generic analyzer.

It is a guided downloader that:

1. loads a media URL
2. asks the user for mode, container, and quality
3. prepares the file on the server
4. delivers the result in Telegram when possible
5. falls back to the web app when Telegram delivery is too limited

## Ready-To-Use Copy

### Best Short Description

`🎬 Download videos and audio in Telegram.`

### Alternative Short Description

`📥 Download media with format and quality control.`

### Best Welcome Message

#### English

```text
🚀 PulsorClip is ready.

Send one media link.
Choose:
- video or audio
- container
- quality

Then I prepare the file and deliver it here when possible.
```

#### French

```text
🚀 PulsorClip est pret.

Envoie un lien media.
Choisis :
- video ou audio
- conteneur
- qualite

Puis je prepare le fichier et je le livre ici quand c est possible.
```

## BotFather Metadata

### Display Name

`PulsorClip`

### Username

`@pulsorclip_bot`

### Short Description

`🎬 Download videos and audio in Telegram.`

### Long Description

`Send a supported media link, choose video or audio, pick the final container and quality, then receive the prepared file in Telegram or continue in the web app if the file is too large.`

## Welcome Message

### English

```text
🚀 PulsorClip is ready.

Send one media link.
Choose:
- video or audio
- container
- quality

Then I prepare the file and deliver it here when possible.
```

### French

```text
🚀 PulsorClip est pret.

Envoie un lien media.
Choisis :
- video ou audio
- conteneur
- qualite

Puis je prepare le fichier et je le livre ici quand c est possible.
```

## Language Onboarding

The bot should ask for language before the main flow when the user has no saved preference.

### Prompt

#### English

`🌐 Choose your Telegram language.`

#### French

`🌐 Choisis ta langue Telegram.`

### Save Confirmation

#### English

`✅ Language saved. PulsorClip will keep using it in this chat.`

#### French

`✅ Langue enregistree. PulsorClip l utilisera maintenant dans cette conversation.`

## Public Commands

### English

- `/start` - start the guided flow
- `/language` - choose the bot language
- `/help` - show commands and examples
- `/video <url> --format=mp4` - download a video from a URL
- `/audio <url> --format=mp3` - download audio from a URL
- `/mp4` - save video mode, then send a URL
- `/mp3` - save audio mode, then send a URL
- `/formats` - list supported download formats

### French

- `/start` - demarrer le flow guide
- `/language` - choisir la langue du bot
- `/help` - afficher les commandes et exemples
- `/video <url> --format=mp4` - telecharger une video depuis une URL
- `/audio <url> --format=mp3` - telecharger un audio depuis une URL
- `/mp4` - memoriser le mode video puis envoyer une URL
- `/mp3` - memoriser le mode audio puis envoyer une URL
- `/formats` - lister les formats pris en charge

## Admin-Only Commands

These commands should only be visible to configured admins.

- `/status`
- `/server`
- `/queue`
- `/health`
- `/report`
- `/daily`

They should never appear in public help copy or public command scopes.

## UX Rules

### Loading

- Start with one temporary `Loading...` message.
- Delete or replace it after media details are available.
- Use a single media message when possible:
  - preview image
  - caption with title, source, duration
  - inline buttons for next choices

### Choices

- First ask for mode only if the mode is not already forced.
- Then ask for container.
- Then ask for quality.
- Keep the same Telegram message and edit it instead of sending a new block for every step.

### Progress

- Queue updates should mention position.
- Export updates should show progress text and a bar.
- Ready state should clearly say the file is being delivered now.

### Delivery

- Use `sendAudio` for audio.
- Use `sendVideo` for supported video delivery.
- Fall back to `sendDocument` when Telegram streaming delivery is not possible.
- Fall back to the web app when file size exceeds Telegram limits.

## YouTube Positioning

PulsorClip should not present YouTube as guaranteed.

Recommended wording:

`YouTube is not stable on many hosts without authenticated cookies. Expect failures unless cookies are configured.`

## Notes

- Admin startup notifications only work if the admin account has already started a private chat with the bot.
- At startup, the bot now logs:
  - the actual Telegram bot username returned by `getMe()`
  - the configured admin IDs
  - which admin IDs are reachable through `getChat()`
  - which admin IDs fail and why
- Public command scopes and admin command scopes should be maintained separately.
- Telegram inline mode must be enabled in BotFather with `/setinline`. The code alone cannot activate inline mode on Telegram.
- If commands do not appear immediately, restart the bot process and reopen the chat menu in Telegram so `setMyCommands` can refresh the client.
- Stored user preferences can remain lightweight:
  - locale
  - preferred mode
  - future delivery preferences
- For extractor diagnostics, enable:
  - `PULSORCLIP_DEBUG_LOGS=true`
  - `PULSORCLIP_LOG_FULL_URLS=true` only if you explicitly want full URLs in logs
