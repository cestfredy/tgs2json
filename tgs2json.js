#!/usr/bin/env node

// tgs2json tools !
// Having the .tgs files, I initially thought about using an external tool to convert them into .json for my needs.
// But then I thought, why not write my own script?
// It's quite simple, and here it's: I built tgs2json!

import { gunzipSync } from 'node:zlib';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

const { version } = JSON.parse(await fs.readFile(new URL('./package.json', import.meta.url), 'utf-8'));

const HELP = `tgs2json v${version}
Convert Telegram .tgs stickers into .json (Lottie) files.

Usage:
  tgs2json [options] <file.tgs...>
  tgs2json [options] *

Options:
  -o, --output <dir>  Output directory (created if missing, default: current directory)
  -h, --help          Show this help
  -v, --version       Show version`;

const isTgsFile = file => path.extname(file).toLowerCase() === '.tgs';

// Write the decompressed tgs data into a JSON file with the same original name.
// Returns true on success, false on failure.
async function convertTgsToJson(tgsFilePath, outputDirectory) {
    try {
        const fileBuffer = await fs.readFile(tgsFilePath);
        const decompressedData = gunzipSync(fileBuffer).toString('utf-8');

        const fileName = path.basename(tgsFilePath, path.extname(tgsFilePath));
        const jsonFilePath = path.join(outputDirectory, `${fileName}.json`);

        await fs.writeFile(jsonFilePath, decompressedData, 'utf-8');
        console.log(`Successfully converted file: ${jsonFilePath}`);
        return true;
    } catch (error) {
        console.error(`Error converting ${tgsFilePath}: ${error.message}`);
        return false;
    }
}

// Retrieve all files with the .tgs extension in a given folder
async function getTgsFiles(directory) {
    try {
        const entries = await fs.readdir(directory, { withFileTypes: true });
        return entries.filter(entry => entry.isFile() && isTgsFile(entry.name)).map(entry => entry.name);
    } catch (error) {
        console.error(`Error reading directory: ${error.message}`);
        return [];
    }
}

// Main function to handle command line arguments and convert all or specifics .tgs files in a given directory
async function run() {
    let values, positionals;
    try {
        ({ values, positionals } = parseArgs({
            allowPositionals: true,
            options: {
                output: { type: 'string', short: 'o' },
                help: { type: 'boolean', short: 'h' },
                version: { type: 'boolean', short: 'v' },
            },
        }));
    } catch (error) {
        console.error(`${error.message}\n\n${HELP}`);
        process.exit(1);
    }

    if (values.help) {
        console.log(HELP);
        return;
    }
    if (values.version) {
        console.log(version);
        return;
    }

    const directoryPath = process.cwd();
    const outputDirectory = path.resolve(values.output ?? directoryPath);

    if (positionals.length === 0) {
        console.error(`Please provide a .tgs file or * to convert all files in the current directory.\n\n${HELP}`);
        process.exit(1);
    }

    // `*` is passed as-is on Windows (cmd/PowerShell); on Unix shells it's already expanded,
    // so in both cases we only keep the .tgs files.
    const tgsFiles = positionals.includes('*')
        ? await getTgsFiles(directoryPath)
        : positionals.filter(isTgsFile);

    if (tgsFiles.length === 0) {
        console.error('No .tgs files found.');
        process.exit(1);
    }

    // Create the output directory if it doesn't exist
    try {
        await fs.mkdir(outputDirectory, { recursive: true });
    } catch (error) {
        console.error(`Error creating output directory: ${error.message}`);
        process.exit(1);
    }

    let failures = 0;
    for (const tgsFile of tgsFiles) {
        const ok = await convertTgsToJson(path.resolve(directoryPath, tgsFile), outputDirectory);
        if (!ok) failures++;
    }

    if (failures > 0) {
        console.error(`${failures} of ${tgsFiles.length} file(s) failed to convert.`);
        process.exit(1);
    }
}

run();
