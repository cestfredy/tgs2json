# tgs2json

Convert Telegram `.tgs` stickers to Lottie `.json`. No dependencies.

## Install

```sh
npm i -g tgs2json
```

Requires Node.js 18.11+.

## Usage

```sh
tgs2json sticker.tgs              # one file
tgs2json a.tgs b.tgs              # several files
tgs2json *                        # every .tgs in the current directory
tgs2json -o out *                 # write to ./out (created if missing)
```

| Option               | Description                                |
| -------------------- | ------------------------------------------ |
| `-o, --output <dir>` | Output directory (default: current directory) |
| `-h, --help`         | Show help                                  |
| `-v, --version`      | Show version                               |

Exits with code `1` if any file fails to convert.

## License

[MIT](LICENSE)
