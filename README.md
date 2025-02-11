# normal - Audio Loudness Normalizer

A command-line tool that normalizes audio files to a consistent loudness level of -13 LUFS using FFmpeg. This tool processes audio files to professional broadcast standards, ensuring consistent volume levels across your audio collection.

## Features

- Normalizes audio files to -13 LUFS (Loudness Units Full Scale)
- Supports multiple audio formats (MP3, WAV, FLAC)
- Preserves audio quality while adjusting loudness
- Provides detailed processing feedback and debugging information
- Includes loudness verification after processing
- Maintains original sample rate (44.1kHz)

## Prerequisites

- macOS with Homebrew installed
- FFmpeg installed via Homebrew (`brew install ffmpeg`)
- Node.js installed on your system

## Installation

1. Clone this repository:
```bash
git clone https://github.com/renderghost/normal.git
cd normal
```

2. Make sure you have FFmpeg installed:
```bash
brew install ffmpeg
```

## Usage

Run the script and follow the interactive prompt:

```bash
node normal.js
```

When prompted, enter the path to your audio file. The tool will:
1. Analyze the current loudness of the file
2. Process the audio to achieve -13 LUFS
3. Verify the resulting loudness
4. Replace the original file if the normalization was successful

## Technical Details

- Target Loudness: -13 LUFS
- Loudness Range (LRA): 7
- True Peak: -1 dBTP
- Sample Rate: 44.1kHz
- Supported Formats: MP3, WAV, FLAC

## How it Works

1. **Input Validation**: The tool first checks if the input file exists and is in a supported format.

2. **FFmpeg Processing**: Uses FFmpeg's `loudnorm` filter with these parameters:
- Input Loudness (I): -13 LUFS
- Loudness Range (LRA): 7
- True Peak (TP): -1 dBTP

3. **Verification**: After processing, the tool:
- Creates a temporary normalized file
- Measures its loudness using EBU R128 standards
- Verifies the result is within ±1 LUFS of the target
- Only replaces the original if verification passes

4. **Cleanup**: Removes temporary files and provides detailed feedback about the process.

The tool includes extensive error handling and debugging information to help troubleshoot any issues that may arise during processing.

