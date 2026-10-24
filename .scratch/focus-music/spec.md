Status: ready-for-agent

## Problem Statement

The Focus Music frame is a placeholder. A person who wants background sound to work to has to open another app, and cannot combine a calm ambient sound with their own music.

## Solution

Focus Music plays built-in generated ambient sounds and the person's own tracks, layered together, with separate volumes. Controls are play/pause, a volume per layer, previous and next track, and loop. The person's tracks are committed to the project and listed in a small file that gives each one a title.

## User Stories

1. As a person, I want to choose one built-in sound (rain, brown noise, white noise, or a café murmur), so that I have background sound without downloading anything.
2. As a person, I want to choose one of my own tracks, so that I can focus with my own music.
3. As a person, I want a built-in sound and a track to play together, so that I can layer rain under my music.
4. As a person, I want a volume slider for the built-in sound and another for the track, so that I can balance them.
5. As a person, I want one play/pause control for everything, so that I can start or stop the focus audio at once.
6. As a person, I want previous and next buttons for my tracks, so that I can move through them.
7. As a person, I want a loop option, so that the current track repeats when it ends.
8. As a person, I want my volumes, chosen sound, chosen track and loop setting to be remembered after a reload, so that I don't set them again.
9. As a person, I want playback to start paused after a reload, so that audio never starts without my action.
10. As a person, I want the audio to keep playing when I switch to another frame, so that switching frames doesn't interrupt my focus.
11. As a person, I want to see a clear message when no tracks are listed yet, so that I know what to add.

## Implementation Decisions

- Built-in sounds are generated in the browser with Web Audio from noise sources and filters. No audio files are bundled for them.
- Built-in sounds are: rain, brown noise, white noise, café murmur. Only one built-in sound plays at a time, or none.
- The person's tracks live in a public music folder in the project. A list file in that folder gives each track a file name and a title. Tracks are listed in the order in the file.
- The list file is read once when the app starts playing. A missing or invalid list file means no tracks, and the frame says so.
- Playback model: the built-in sound and the current track are two layers, each with its own volume. Pressing play starts every layer that is selected. Pressing pause stops them all.
- Changing the track while playing switches to the new track and keeps playing.
- Next and previous wrap around the list.
- Loop repeats the current track when it ends. Without loop, the next track plays when a track ends, and playback stops after the last one.
- Settings are saved under one storage key: sound, sound volume, track, track volume, loop. Playback state is not saved.
- Playback lives outside the frame. Switching frames, or closing the Focus Music frame, does not stop audio.
- Pure logic (settings validation, track list parsing, next and previous index) is in its own module and is unit tested. The audio engine and the frame are verified in the browser.

## Testing Decisions

- Unit tests cover: loading and saving settings (missing, corrupt, out-of-range values), parsing the track list (valid, invalid, empty), next and previous track index with wrap-around, and loop/end-of-track decisions.
- Prior art: the existing Todo logic tests and migration tests.
- Browser checks cover: built-in sound and track layering, volume sliders, play/pause, next/previous, loop, settings after reload with playback paused, audio continuing after a frame switch, and the empty-list message.

## Out of Scope

- Streaming from music services.
- Uploading files through the app. Tracks are added by putting files in the music folder and listing them.
- Playlists beyond the single track list.
- Keyboard shortcuts for playback (to be considered after the frame works).

## Further Notes

- The person's audio files are committed to git as they chose. The person is responsible for having the rights to commit them.
