const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const readline = require('readline');

const supportedExtensions = ['mp3', 'wav', 'flac'];
let processedFiles = 0;
let skippedFiles = 0;
let errorFiles = 0;

function debug(message) {
    console.log(`Debug: ${message}`);
}

function checkFFmpegInstallation() {
    try {
        spawnSync('/opt/homebrew/bin/ffmpeg', ['-version']);
        return true;
    } catch (error) {
        debug(`FFmpeg check failed: ${error.message}`);
        return false;
    }
}

function getFileExtension(filename) {
    return path.extname(filename).slice(1).toLowerCase();
}

async function checkLoudness(filePath) {
    debug(`Checking loudness for file: ${filePath}`);
    const ffmpegArgs = ['-i', filePath, '-vn', '-filter:a', 'ebur128=peak=true', '-f', 'null', '-'];
    debug(`Executing FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`);

    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('/opt/homebrew/bin/ffmpeg', ffmpegArgs);
        let output = '';

        ffmpeg.stderr.on('data', (data) => {
            output += data.toString();
        });

        ffmpeg.on('close', (code) => {
            if (code !== 0) {
                debug(`FFmpeg process exited with code ${code}`);
                reject(new Error(`FFmpeg process failed with code ${code}`));
                return;
            }

            debug(`Raw ebur128 output: ${output}`);
            const summaryMatch = output.match(/Integrated loudness:\s+I:\s+([-\d.]+)\s+LUFS/);
            if (summaryMatch && summaryMatch[1]) {
                const loudness = parseFloat(summaryMatch[1]);
                debug(`Parsed loudness value: ${loudness} LUFS`);
                resolve(loudness);
            } else {
                debug(`Loudness data not found in FFmpeg output`);
                resolve(null);
            }
        });
    });
}

async function processFile(filePath) {
    debug(`Processing file: ${filePath}`);
    const fileName = path.basename(filePath);
    const tempFile = path.join('/tmp', `normalized_${fileName}`);

    // Check if file exists and is readable
    try {
        fs.accessSync(filePath, fs.constants.R_OK);
        debug(`File exists and is readable: ${filePath}`);
    } catch (error) {
        errorFiles++;
        debug(`Error accessing file ${fileName}: ${error.message}`);
        throw new Error(`Error: ${error.message}`);
    }

    // Run FFmpeg command with updated parameters
    const ffmpegArgs = [
        '-y',
        '-i', filePath,
        '-vn',
        '-af', 'loudnorm=I=-13:LRA=7:TP=-1:print_format=summary',
        '-ar', '44100',
        tempFile
    ];
    debug(`Executing FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`);

    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('/opt/homebrew/bin/ffmpeg', ffmpegArgs);
        let ffmpegError = '';

        ffmpeg.stderr.on('data', (data) => {
            ffmpegError += data.toString();
        });

        ffmpeg.on('close', async (code) => {
            if (code !== 0) {
                debug(`FFmpeg process exited with code ${code}`);
                debug(`FFmpeg error output: ${ffmpegError}`);
                errorFiles++;
                reject(new Error(`FFmpeg process failed with code ${code}`));
                return;
            }

            debug(`FFmpeg process completed successfully`);
            try {
                // Check loudness of the processed file
                const loudness = await checkLoudness(tempFile);

                if (loudness !== null) {
                    if (Math.abs(loudness - (-13)) <= 1) {  // Allow 1 LUFS tolerance
                        // Replace original file if loudness is correct
                        fs.renameSync(tempFile, filePath);
                        processedFiles++;
                        resolve(`Processed: ${loudness.toFixed(2)} LUFS`);
                    } else {
                        errorFiles++;
                        debug(`Failed loudness check: ${loudness.toFixed(2)} LUFS`);
                        resolve(`Failed loudness check: ${loudness.toFixed(2)} LUFS`);
                    }
                } else {
                    errorFiles++;
                    debug(`Failed to check loudness: Unable to determine loudness value`);
                    resolve("Failed to check loudness: Unable to determine loudness value");
                }
            } catch (error) {
                errorFiles++;
                debug(`Error during loudness check: ${error.message}`);
                resolve(`Error during loudness check: ${error.message}`);
            } finally {
                // Clean up temp file if it exists
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                    debug(`Removed temp file: ${tempFile}`);
                }
            }
        });
    });
}


async function processFiles(filePaths) {
    debug(`Processing ${filePaths.length} file(s)`);
    const results = [];
    for (const filePath of filePaths) {
        const fileName = path.basename(filePath);
        const fileExtension = getFileExtension(fileName);

        if (supportedExtensions.includes(fileExtension)) {
            try {
                const result = await processFile(filePath);
                results.push({ fileName, result });
            } catch (error) {
                results.push({ fileName, result: `Error: ${error.message}` });
            }
        } else {
            skippedFiles++;
            results.push({ fileName, result: "Skipped: Unsupported file type" });
        }
    }

    // Log results
    results.forEach(result => {
        console.log(`${result.fileName}: ${result.result}`);
    });

    // Print summary
    console.log(`\nSummary:`);
    console.log(`Processed: ${processedFiles}, Skipped: ${skippedFiles}, Errors: ${errorFiles} (Total: ${filePaths.length})`);
}

// Main execution
if (!checkFFmpegInstallation()) {
    console.error("FFmpeg is not found at /opt/homebrew/bin/ffmpeg. Please ensure FFmpeg is installed via Homebrew and accessible.");
    process.exit(1);
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('Enter the path to the audio file: ', async (filePath) => {
    rl.close();
    debug(`Received file path: ${filePath}`);

    // Remove surrounding quotes if present
    filePath = filePath.replace(/^['"](.*)['"]$/, '$1');
    debug(`File path after removing quotes: ${filePath}`);

    // Resolve to absolute path
    const absolutePath = path.resolve(filePath);
    debug(`Resolved absolute path: ${absolutePath}`);

    if (!fs.existsSync(absolutePath)) {
        console.error(`File not found: ${absolutePath}`);
        debug(`Current working directory: ${process.cwd()}`);
        debug(`File exists check failed for: ${absolutePath}`);
        process.exit(1);
    }

    await processFiles([absolutePath]);
});
