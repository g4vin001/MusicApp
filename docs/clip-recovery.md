# Local clip recovery

The single-clip editor helps visitors inspect and prepare difficult recordings without sending audio anywhere. It works before recognition is activated. No account, provider request or additional dependency is needed for preview and download.

## Flow

1. Upload or record audio. The original file remains on the visitor's device.
2. Pick a start time, including tenths of a second, and optionally adjust coupled speed/pitch.
3. Listen to the original. Keep the channel mix by default; select the left or right channel when that makes the music clearer.
4. Optionally reduce low rumble, soften high hiss, and boost quiet audio.
5. Preview the prepared section, download it as WAV, or identify it when recognition is configured. Preview edit and Prepare download both render the current settings; the resulting Download clip link saves the WAV directly through the browser.

Preview, download preparation and single-clip identification all use `prepareClip`. A changed setting marks the previous preview as stale and removes its download link until the new settings are prepared. Identification always renders the current settings rather than sending the old preview. Only one of the original/prepared audio players plays at a time. Timeline scans continue to use the original channel mix, speed and level without these single-clip edits.

## Processing

`OfflineAudioContext` resamples up to 12 output seconds to mono 22,050 Hz audio. Left/right selection copies only the selected short source window, not the entire recording. The default channel mix keeps the browser's established downmix behavior.

Optional second-order Butterworth filters use a 120 Hz high-pass and a 6 kHz low-pass. Gain is capped at 5× for quiet-audio boost; filtered overshoot is attenuated before 16-bit PCM encoding. The default unfiltered, unboosted path retains the existing samples and encoding behavior. Original source buffers are never modified.

Filter coefficients follow the [W3C Audio EQ Cookbook](https://www.w3.org/TR/audio-eq-cookbook/). Browser rendering uses [OfflineAudioContext](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext).

## What the checks mean

Source checks flag near-silence, low signal level, possible clipping and stereo cancellation in the selected window. Cancellation detection compares the stereo mix with each original channel and suggests a channel to try. These are signal-level heuristics, not music detection, recognition confidence or a promise of improved accuracy. Checks describe the selected source before filtering/boosting; multichannel source levels are approximate.

Filtering may discard musical detail. It does not perform source separation, remove speech, repair clipped recordings, or change pitch independently of tempo. Compare the original and edited clip. Prefer the original for the first recognition attempt.

## Verification

`tests/clip-processing.test.mjs` checks time bounds, invalid settings, opposed stereo channels, silence/quiet/clipping diagnostics, filter attenuation against generated tones, midrange preservation, bounded gain, source immutability and WAV compatibility with the actual recognition validator. These synthetic checks verify processing behavior, not recognition accuracy; the labeled recognition benchmark remains a separate gate.
