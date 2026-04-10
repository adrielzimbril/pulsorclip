# PulsorClip Telegram Bot

This document centralizes the Telegram bot copy, BotFather metadata, onboarding text, and UX rules used by PulsorClip.

## Purpose

The bot is not a generic downloader.

It is a guided export assistant that:

1. inspects a media URL
2. asks the user for mode, container, and quality
3. prepares the file on the server
4. delivers the result in Telegram when possible
5. falls back to the web app when Telegram delivery is too limited

## Ready-To-Use Copy

### Best Short Description

`🎬 Inspect links and get guided exports in Telegram.`

### Alternative Short Description

`🎧 Inspect media URLs and receive guided exports.`

### Best Welcome Message

#### English

```text
🚀 PulsorClip is ready.

Send one media URL.
I will guide you through:
- mode
- container
- quality

Then I prepare the file and deliver it here when possible.
```

#### French

```text
🚀 PulsorClip est pret.

Envoie une URL media.
Je te guide ensuite sur :
- le mode
- le conteneur
- la qualite

Puis je prepare le fichier et je le livre ici quand c est possible.
```

## BotFather Metadata

### Display Name

`PulsorClip`

### Username

`@pulsorclip_bot`

### Short Description

`🎬 Inspect links and get guided exports in Telegram.`

### Long Description

`Send a supported URL, choose video or audio, pick the final container and quality, then receive the prepared file in Telegram or continue in the web app if the file is too large.`

## Welcome Message

### English

```text
🚀 PulsorClip is ready.

Send one media URL.
I will guide you through:
- mode
- container
- quality

Then I prepare the file and deliver it here when possible.
```

### French

```text
🚀 PulsorClip est pret.

Envoie une URL media.
Je te guide ensuite sur :
- le mode
- le conteneur
- la qualite

Puis je prepare le fichier et je le livre ici quand c est possible.
```

## Language Onboarding

The bot should ask for language before the main flow when the user has no saved preference.

### Prompt

#### English

`Choose your Telegram language before starting the export flow.`

#### French

`Choisis la langue Telegram avant de commencer le flow d export.`

### Save Confirmation

#### English

`Language saved. PulsorClip will keep using this language in this chat.`

#### French

`Langue enregistree. PulsorClip utilisera maintenant cette langue dans cette conversation.`

## Public Commands

### English

- `/start` - start the guided flow
- `/language` - choose the bot language
- `/help` - show commands and examples
- `/video <url> --format=mp4` - inspect a URL for video export
- `/audio <url> --format=mp3` - inspect a URL for audio export
- `/mp4` - save video mode, then send a URL
- `/mp3` - save audio mode, then send a URL
- `/formats` - list supported export containers

### French

- `/start` - demarrer le flow guide
- `/language` - choisir la langue du bot
- `/help` - afficher les commandes et exemples
- `/video <url> --format=mp4` - inspecter une URL pour la video
- `/audio <url> --format=mp3` - inspecter une URL pour l audio
- `/mp4` - memoriser le mode video puis envoyer une URL
- `/mp3` - memoriser le mode audio puis envoyer une URL
- `/formats` - lister les conteneurs pris en charge

## Admin-Only Commands

These commands should only be visible to configured admins.

- `/status`
- `/health`
- `/report`
- `/daily`

They should never appear in public help copy or public command scopes.

## UX Rules

### Inspection

- Start with one temporary `Inspecting...` message.
- Delete or replace it after metadata is available.
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
- Public command scopes and admin command scopes should be maintained separately.
- Stored user preferences can remain lightweight:
  - locale
  - preferred mode
  - future delivery preferences
