#!/usr/bin/env node

// tgs2json tools !
// Having the .tgs files, I initially thought about using an external tool to convert them into .json for my needs.
// But then I thought, why not write my own script?
// It's quite simple, and here it's: I built tgs2json!

import { gunzipSync } from 'node:zlib';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

// Write the decompressed tgs data into a JSON file with the same original name.
async function convertTgsToJson(tgsFilePath, outputDirectory) {
    try {
        const fileBuffer = await fs.readFile(tgsFilePath);
        const decompressedData = gunzipSync(fileBuffer).toString('utf-8');

        const fileName = path.basename(tgsFilePath, '.tgs');
        const jsonFilePath = path.join(outputDirectory, `${fileName}.json`);

        await fs.writeFile(jsonFilePath, decompressedData, 'utf-8');
        console.log(`Successfull converted file: ${jsonFilePath}`);
    } catch (error) {
        console.error('Error occur during the conversion from .tgs to .json: ', error);
    }
}

// Retrieve all files with the .tgs extension in a given folder
async function getTgsFiles(directory) {
    try {
        const files = await fs.readdir(directory);
        return files.filter(file => path.extname(file) === '.tgs');
    } catch (error) {
        console.error('Error reading directory:', error);
        return [];
    }
}

// Main function to handle command line arguments and convert all or specifics .tgs files in a given directory
async function run() {
    const args = process.argv.slice(2);
    const directoryPath = process.cwd();
    let outputDirectory = directoryPath;

    if (args.length === 0) {
        console.error('Please provide a .tgs file or * to convert all files in the current directory.');
        process.exit(1);
    }

    const outputIndex = args.indexOf('-o');
    if (outputIndex !== -1 && args[outputIndex + 1]) {
        outputDirectory = path.resolve(args[outputIndex + 1]);
        args.splice(outputIndex, 2); // Remove the -o and the output directory from the arguments
    }

    // Create the output directory if it doesn't exist
    try {
        await fs.mkdir(outputDirectory, { recursive: true });
    } catch (error) {
        console.error('Error creating output directory:', error);
        process.exit(1);
    }


    if (args[0] === '*') {
        const tgsFiles = await getTgsFiles(directoryPath);
        if (tgsFiles.length === 0) {
            console.error('No .tgs files found in the current directory.');
            process.exit(1);
        }

        for (const tgsFile of tgsFiles) {
            const tgsFilePath = path.join(directoryPath, tgsFile);
            try {
                await convertTgsToJson(tgsFilePath, outputDirectory);
            } catch {
                console.error(`Error converting file with path: ${tgsFilePath}`);
            }
        }
    } else {
        for (const tgsFile of args) {
            const tgsFilePath = path.join(directoryPath, tgsFile);
            try {
                await convertTgsToJson(tgsFilePath, outputDirectory);
            } catch {
                console.error(`Error converting file with path: ${tgsFilePath}`);
            }
        }
    }
}

run();