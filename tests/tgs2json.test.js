import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(TESTS_DIR, '..', 'tgs2json.js');
const FIXTURES = ['sticker.tgs', 'magic.tgs'];
const { version } = JSON.parse(fs.readFileSync(path.join(TESTS_DIR, '..', 'package.json'), 'utf-8'));

let cwd;

// Each test runs in a fresh temp directory containing copies of the fixtures.
beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'tgs2json-'));
    for (const fixture of FIXTURES) {
        fs.copyFileSync(path.join(TESTS_DIR, fixture), path.join(cwd, fixture));
    }
});

afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
});

const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf-8' });
const readJson = file => JSON.parse(fs.readFileSync(path.join(cwd, file), 'utf-8'));
const expectedJson = fixture => JSON.parse(gunzipSync(fs.readFileSync(path.join(TESTS_DIR, fixture))));

test('converts a single file into valid Lottie JSON', () => {
    const { status } = run('sticker.tgs');

    assert.equal(status, 0);
    const json = readJson('sticker.json');
    assert.deepEqual(json, expectedJson('sticker.tgs'));
    assert.equal(json.tgs, 1);
    assert.equal(json.w, 512);
    assert.equal(json.h, 512);
    assert.ok(Array.isArray(json.layers) && json.layers.length > 0);
    assert.ok(!fs.existsSync(path.join(cwd, 'magic.json')));
});

test('converts several files', () => {
    const { status } = run('sticker.tgs', 'magic.tgs');

    assert.equal(status, 0);
    assert.deepEqual(readJson('sticker.json'), expectedJson('sticker.tgs'));
    assert.deepEqual(readJson('magic.json'), expectedJson('magic.tgs'));
});

test('* converts every .tgs in the current directory and ignores other files', () => {
    fs.writeFileSync(path.join(cwd, 'notes.txt'), 'not a sticker');

    const { status } = run('*');

    assert.equal(status, 0);
    assert.deepEqual(readJson('sticker.json'), expectedJson('sticker.tgs'));
    assert.deepEqual(readJson('magic.json'), expectedJson('magic.tgs'));
    assert.ok(!fs.existsSync(path.join(cwd, 'notes.json')));
});

test('ignores non-.tgs arguments expanded by the shell', () => {
    fs.writeFileSync(path.join(cwd, 'notes.txt'), 'not a sticker');
    fs.mkdirSync(path.join(cwd, 'out'));

    const { status } = run('-o', 'out', 'magic.tgs', 'notes.txt', 'out', 'sticker.tgs');

    assert.equal(status, 0);
    assert.deepEqual(fs.readdirSync(path.join(cwd, 'out')).sort(), ['magic.json', 'sticker.json']);
});

test('-o writes into the output directory and creates it if missing', () => {
    const { status } = run('-o', 'nested/out', '*');

    assert.equal(status, 0);
    assert.deepEqual(readJson('nested/out/sticker.json'), expectedJson('sticker.tgs'));
    assert.deepEqual(readJson('nested/out/magic.json'), expectedJson('magic.tgs'));
    assert.ok(!fs.existsSync(path.join(cwd, 'sticker.json')));
});

test('--output is an alias of -o', () => {
    const { status } = run('--output', 'out', 'sticker.tgs');

    assert.equal(status, 0);
    assert.deepEqual(readJson('out/sticker.json'), expectedJson('sticker.tgs'));
});

test('accepts absolute input paths', () => {
    const { status } = run('-o', 'out', path.join(cwd, 'sticker.tgs'));

    assert.equal(status, 0);
    assert.deepEqual(readJson('out/sticker.json'), expectedJson('sticker.tgs'));
});

test('accepts the .TGS extension in any case', () => {
    fs.renameSync(path.join(cwd, 'sticker.tgs'), path.join(cwd, 'STICKER.TGS'));

    const { status } = run('*');

    assert.equal(status, 0);
    assert.deepEqual(readJson('STICKER.json'), expectedJson('sticker.tgs'));
});

test('keeps converting after a corrupted file and exits with 1', () => {
    fs.writeFileSync(path.join(cwd, 'broken.tgs'), 'not gzip');

    const { status, stderr } = run('*');

    assert.equal(status, 1);
    assert.match(stderr, /broken\.tgs/);
    assert.match(stderr, /1 of 3 file\(s\) failed/);
    assert.deepEqual(readJson('sticker.json'), expectedJson('sticker.tgs'));
    assert.deepEqual(readJson('magic.json'), expectedJson('magic.tgs'));
});

test('exits with 1 when an input file does not exist', () => {
    const { status, stderr } = run('missing.tgs');

    assert.equal(status, 1);
    assert.match(stderr, /missing\.tgs/);
});

test('exits with 1 and shows help when no argument is given', () => {
    const { status, stderr } = run();

    assert.equal(status, 1);
    assert.match(stderr, /Usage:/);
});

test('exits with 1 when no .tgs file is found', () => {
    for (const fixture of FIXTURES) fs.rmSync(path.join(cwd, fixture));

    const { status, stderr } = run('*');

    assert.equal(status, 1);
    assert.match(stderr, /No \.tgs files found/);
});

test('exits with 1 when -o has no value', () => {
    const { status } = run('sticker.tgs', '-o');

    assert.equal(status, 1);
});

test('exits with 1 on an unknown option', () => {
    const { status, stderr } = run('--nope', 'sticker.tgs');

    assert.equal(status, 1);
    assert.match(stderr, /Unknown option/);
});

test('--help prints usage', () => {
    const { status, stdout } = run('--help');

    assert.equal(status, 0);
    assert.match(stdout, /Usage:/);
    assert.match(stdout, /--output/);
});

test('--version prints the package version', () => {
    const { status, stdout } = run('-v');

    assert.equal(status, 0);
    assert.equal(stdout.trim(), version);
});
