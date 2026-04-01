# NFC Event CLI

Simple Windows-friendly CLI for assigning NFC bracelets to attendees and checking them in at the event.

This project is built for:
- `ACR122U` USB NFC reader
- `MIFARE Classic 1K` bracelets
- `Firestore` as the database
- `Node.js` on Windows, macOS, or Linux

The main audience for this README is a non-technical Windows user.

## What This Project Does

This CLI has 3 jobs:

1. `seed`
Creates fake attendees in Firestore for testing.

2. `assign`
Reads a bracelet's UID, writes the event URL to the bracelet, and links that bracelet to the next unassigned attendee in Firestore.

3. `checkin`
Reads a bracelet's UID and marks that attendee as present.

The system uses the bracelet's built-in UID as the identity. It does not need to write a custom attendee ID to the bracelet.

## How It Works

Each attendee is stored in Firestore as a document like this:

```json
{
  "name": "Salma Bennani",
  "email": "salma.bennani@example.com",
  "braceletUid": null,
  "present": false,
  "checkedInAt": null
}
```

During assignment:
- the CLI finds the next attendee with `braceletUid = null`
- you tap a bracelet on the reader
- the CLI reads the UID
- the CLI writes the event URL to the bracelet
- the CLI saves the UID into Firestore for that attendee

During check-in:
- the CLI loads all assigned bracelets into memory at startup
- you tap a bracelet on the reader
- the CLI finds the attendee by UID
- the CLI marks them as present

## Before You Start

You need 4 things:

1. A Windows PC
2. An `ACR122U` USB NFC reader
3. NFC bracelets compatible with your event setup
4. A Firebase service account JSON file with access to Firestore

This project expects the Firebase JSON file to be placed in the project folder with this exact name:

```text
nfcc-8a2e5-firebase-adminsdk-fbsvc-ce0d91f4e3.json
```

If the file has a different name, the CLI can still work, but you must pass `--service-account` every time.

## Important Security Warning

Your Firebase service account JSON is a secret.

Do not:
- upload it to GitHub
- send it in chat apps
- email it around casually
- commit it into git history

This repository ignores that file locally, but you still need to keep it private.

## Step 1: Install Node.js on Windows

Node.js is required. `npm` is included with Node.js.

Official download page:
- <https://nodejs.org/en/download>

What to do:

1. Open the Node.js download page.
2. Download the current `LTS` Windows installer.
3. Run the installer.
4. Accept the defaults.
5. Finish the installation.

After installation:

1. Open `PowerShell`
2. Run:

```powershell
node -v
npm -v
```

You should see version numbers printed for both commands.

If one of these commands says it is not recognized, close PowerShell, open it again, and retry.

## Step 2: Install Git on Windows (Optional)

Git is only needed if you want to clone the repository or pull updates later.

If you just want to download the project as a ZIP file from GitHub, you can skip Git.

Official Git for Windows page:
- <https://git-scm.com/install/windows>

If you want Git:

1. Open the Git for Windows page.
2. Download the standard `64-bit` installer.
3. Run the installer.
4. Accept the defaults.
5. Finish the installation.

To verify Git:

```powershell
git --version
```

## Step 3: Download This Project

There are 2 ways to get the project onto the computer.

### Option A: Download ZIP from GitHub

GitHub documents this under "Download ZIP":
- <https://docs.github.com/en/repositories/working-with-files/using-files/downloading-source-code-archives>

Steps:

1. Open the GitHub repository page.
2. Click the green `Code` button.
3. Click `Download ZIP`.
4. Extract the ZIP somewhere easy to find.

Recommended location:

```text
C:\Users\YourName\Desktop\event-nfc-cli
```

### Option B: Clone with Git

If Git is installed:

```powershell
git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git
cd YOUR-REPO
```

Replace the GitHub URL with the real one.

## Step 4: Put the Firebase JSON File in the Project Folder

The project folder should contain files like:

```text
package.json
src\
README.md
```

Copy your Firebase service account JSON file into that same folder.

Recommended filename:

```text
nfcc-8a2e5-firebase-adminsdk-fbsvc-ce0d91f4e3.json
```

If you use that exact filename, the CLI will detect it automatically.

If you use a different filename, you must pass it explicitly, for example:

```powershell
npm run seed -- --service-account "C:\Users\YourName\Desktop\my-firebase-key.json"
```

## Step 5: Open PowerShell in the Project Folder

Easy method:

1. Open the project folder in File Explorer.
2. Click the address bar.
3. Type `powershell`
4. Press `Enter`

PowerShell should open directly inside that folder.

You can confirm by running:

```powershell
dir
```

You should see files such as `package.json` and `README.md`.

## Step 6: Install Project Dependencies

Run:

```powershell
npm install
```

This installs the packages required by the project.

When it finishes, you should see a new `node_modules` folder.

## Step 7: Plug In the NFC Reader

Plug the `ACR122U` into a USB port.

Official ACS product page:
- <https://www.acs.com.hk/en/products/3/acr122u-usb-nfc-reader/>

Notes:
- The ACR122U is a PC/SC reader.
- The CLI detects the reader automatically when the operating system exposes it.
- On Windows, the reader may work immediately.
- If Windows does not detect it correctly, install the official ACS PC/SC driver from the ACS support page.

You do not need to manually choose a COM port or USB device in this CLI.

## Step 8: Create Test Data First

Do not test against your real event collection first.

Use a separate Firestore collection such as `registrations_test`.

Run:

```powershell
npm run seed -- --collection registrations_test --count 10
```

What this does:
- creates 10 fake attendees
- stores them in Firestore
- sets `braceletUid` to `null`
- sets `present` to `false`
- sets `checkedInAt` to `null`

If it works, you should see a message like:

```text
Seeded 10 test registrations into registrations_test.
```

### Seed Script Options

Default command:

```powershell
npm run seed
```

Useful examples:

```powershell
npm run seed -- --count 25
npm run seed -- --collection registrations_test --count 10
npm run seed -- --service-account "C:\path\to\file.json" --collection registrations_test --count 10
```

Options:
- `--collection NAME`: Firestore collection name. Default: `registrations`
- `--count NUMBER`: number of fake attendees to create. Default: `10`
- `--service-account PATH`: path to your Firebase JSON file

## Step 9: Assign Bracelets

Assignment means:
- pick the next unassigned attendee from Firestore
- tap a bracelet
- save that bracelet UID for that attendee
- write the event URL onto the bracelet

Use a test collection first.

Example:

```powershell
npm run assign -- --collection registrations_test --url https://your-event-page.example
```

If your service account file is not using the default filename, use:

```powershell
npm run assign -- --service-account "C:\path\to\file.json" --collection registrations_test --url https://your-event-page.example
```

What you will see:

1. The CLI prints the next attendee.
2. The CLI says the reader is ready.
3. You tap a bracelet.
4. The CLI writes the event URL to the bracelet.
5. The CLI saves the UID to Firestore.
6. The CLI prints the next attendee.

Example output:

```text
Next registration: Salma Bennani <salma.bennani.001@example.com>
Reader ready: ACS ACR122U PICC Interface 00 00
Tap the next bracelet to assign it.
[ACS ACR122U PICC Interface 00 00] Writing event URL for Salma Bennani <salma.bennani.001@example.com> (04:A2:3B:7C)...
[ACS ACR122U PICC Interface 00 00] Assigned 04:A2:3B:7C to Salma Bennani <salma.bennani.001@example.com>.
```

### Assign Mode Rules

- `--url` is required in assign mode
- if a bracelet is already assigned to someone else, the CLI warns you and does not overwrite that Firestore mapping
- if writing the URL fails, the attendee is not assigned in Firestore
- when all attendees are assigned, the CLI prints `All registrations are assigned.`

## Step 10: Test the Bracelet With a Phone

After assignment:

1. Unlock a phone with NFC enabled.
2. Tap the bracelet to the phone.
3. The phone should open the event URL.

If the phone opens the correct page, the NDEF write worked.

## Step 11: Run Check-In

Check-in mode loads all assigned bracelets from Firestore into a local memory cache at startup.

That means:
- known bracelets can be recognized quickly
- if Firestore is temporarily slow or unstable, check-in can keep going and sync in the background

Run:

```powershell
npm run checkin -- --collection registrations_test
```

If your service account file is not using the default filename, use:

```powershell
npm run checkin -- --service-account "C:\path\to\file.json" --collection registrations_test
```

What happens:

1. The CLI loads all assigned bracelets into memory.
2. The reader becomes active.
3. You tap a bracelet.
4. The CLI finds the attendee by UID.
5. The CLI marks them present.

Example output:

```text
Loaded 10 assigned bracelets into local cache.
Reader ready: ACS ACR122U PICC Interface 00 00
Check-in is live.
[ACS ACR122U PICC Interface 00 00] Checked in Salma Bennani <salma.bennani.001@example.com> (04:A2:3B:7C)
```

### Check-In Mode Behavior

- if the bracelet UID is unknown, the CLI prints `Unknown bracelet`
- if the attendee is already present, the CLI prints `Already checked in`
- successful check-ins are queued and synced to Firestore
- if Firestore update fails, the CLI retries with backoff

## Recommended First Full Test

Do this in order:

1. Install Node.js
2. Download the project
3. Put the Firebase JSON file in the project folder
4. Run `npm install`
5. Plug in the reader
6. Run `npm run seed -- --collection registrations_test --count 5`
7. Run `npm run assign -- --collection registrations_test --url https://your-event-page.example`
8. Assign 1 or 2 bracelets
9. Tap one bracelet with a phone and confirm the URL opens
10. Stop assign mode with `Ctrl + C`
11. Run `npm run checkin -- --collection registrations_test`
12. Tap the same bracelet and confirm the attendee is checked in

If this full test works, the system is ready for real data.

## Real Event Usage

Use two phases.

### Phase A: The Day Before the Event

Goal: assign bracelets.

Run:

```powershell
npm run assign -- --collection registrations --url https://your-real-event-page.example
```

### Phase B: Event Day

Goal: check people in.

Run:

```powershell
npm run checkin -- --collection registrations
```

Do not use `seed` on your real production collection unless you intentionally want fake attendees there.

## All Commands

### Install dependencies

```powershell
npm install
```

### Seed test attendees

```powershell
npm run seed -- --collection registrations_test --count 10
```

### Assign bracelets

```powershell
npm run assign -- --collection registrations_test --url https://your-event-page.example
```

### Check in attendees

```powershell
npm run checkin -- --collection registrations_test
```

### Build manually

```powershell
npm run build
```

### Type-check manually

```powershell
npm run check
```

## Firestore Collection Notes

Default collection name:

```text
registrations
```

Recommended test collection name:

```text
registrations_test
```

The CLI accepts `--collection` so you can keep test and production data separate.

## If You Want to Use a Different Firebase JSON Filename

That is allowed.

Example:

```powershell
npm run seed -- --service-account "C:\Users\YourName\Desktop\firebase-key.json" --collection registrations_test --count 10
npm run assign -- --service-account "C:\Users\YourName\Desktop\firebase-key.json" --collection registrations_test --url https://your-event-page.example
npm run checkin -- --service-account "C:\Users\YourName\Desktop\firebase-key.json" --collection registrations_test
```

## Stopping the Program

When the CLI is running, press:

```text
Ctrl + C
```

The program will close cleanly.

## Troubleshooting

### `node` is not recognized

Node.js is not installed correctly, or PowerShell needs to be reopened.

Fix:
- install Node.js from <https://nodejs.org/en/download>
- close PowerShell
- open PowerShell again
- run `node -v`

### `git` is not recognized

Git is not installed, or you do not need Git.

Fix:
- either install Git from <https://git-scm.com/install/windows>
- or skip Git and use GitHub's `Download ZIP`

### `Service account file not found`

The Firebase JSON file is missing or the path is wrong.

Fix:
- make sure the file exists in the project root
- or pass `--service-account` with the full path

### `Set --service-account or GOOGLE_APPLICATION_CREDENTIALS before starting the CLI.`

The CLI could not find your Firebase JSON file.

Fix:
- place the file in the project folder with the default filename
- or pass `--service-account`

### The reader is plugged in but nothing happens

Windows may not be exposing the reader correctly.

Fix:
- unplug and re-plug the ACR122U
- try a different USB port
- restart the CLI
- if needed, install the official ACS PC/SC driver from the ACS support page

### The bracelet scans but writing fails during `assign`

This usually means the bracelet authentication keys do not match the default keys the CLI tries.

The CLI already tries these common MIFARE keys:
- `D3F7D3F7D3F7`
- `FFFFFFFFFFFF`
- `A0A1A2A3A4A5`

If your bracelets use custom keys, set `NFC_MIFARE_KEYS` before running the command.

PowerShell example:

```powershell
$env:NFC_MIFARE_KEYS="112233445566,A1B2C3D4E5F6"
npm run assign -- --collection registrations_test --url https://your-event-page.example
```

### `Unknown bracelet` during check-in

That bracelet UID is not assigned in the selected Firestore collection.

Fix:
- make sure you assigned that bracelet first
- make sure you are using the correct collection name
- make sure you are using the same Firebase project

### `Already checked in`

This is not an error. It means that attendee is already marked present.

## Project Structure

```text
src\main.ts       CLI entry point for assign and checkin
src\seed.ts       Seed test attendees into Firestore
src\db.ts         Firestore initialization and queries
src\nfc.ts        NFC reader setup, UID reads, MIFARE writing
src\ndef-util.ts  NDEF URL payload creation
```

## Summary

If you want the shortest setup path on Windows:

1. Install Node.js
2. Download this repo as ZIP
3. Extract it
4. Put the Firebase JSON file in the project folder
5. Open PowerShell in that folder
6. Run `npm install`
7. Run `npm run seed -- --collection registrations_test --count 10`
8. Run `npm run assign -- --collection registrations_test --url https://your-event-page.example`
9. Run `npm run checkin -- --collection registrations_test`

That is enough to test the full flow.
