import type { Firestore } from "firebase-admin/firestore";
import {
  DEFAULT_SERVICE_ACCOUNT_PATH,
  assignBraceletUid,
  formatRegistration,
  getNextUnassignedRegistration,
  getRegistrationByUid,
  initFirestore,
  loadRegistrationCache,
  markRegistrationPresent,
  type Registration,
} from "./db";
import { startNfcSession } from "./nfc";

type Mode = "assign" | "checkin";

interface CliOptions {
  collectionName: string;
  eventUrl?: string;
  mode: Mode;
  serviceAccountPath?: string;
}

interface PendingCheckIn {
  attempts: number;
  registrationId: string;
  uid: string;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const db = initFirestore({
    collectionName: options.collectionName,
    serviceAccountPath: options.serviceAccountPath,
  });

  if (options.mode === "assign") {
    await runAssignMode(db, options);
    return;
  }

  await runCheckinMode(db, options);
}

async function runAssignMode(
  db: Firestore,
  options: CliOptions,
): Promise<void> {
  const eventUrl = options.eventUrl;
  if (!eventUrl) {
    throw new Error("Assign mode requires --url or EVENT_URL.");
  }

  let currentRegistration = await getNextUnassignedRegistration(
    db,
    options.collectionName,
  );
  if (!currentRegistration) {
    console.log("No unassigned registrations remain.");
    return;
  }

  printAssignTarget(currentRegistration);

  const session = startNfcSession({
    onReaderAttached: (readerName) => {
      console.log(`Reader ready: ${readerName}`);
      console.log("Tap the next bracelet to assign it.");
    },
    onReaderDetached: (readerName) => {
      console.log(`Reader removed: ${readerName}`);
    },
    onError: (error) => {
      console.error(`NFC error: ${error.message}`);
    },
    onScan: async ({ readerName, uid, writeEventUrl }) => {
      if (!currentRegistration) {
        console.log("No unassigned registrations remain.");
        return;
      }

      const existingRegistration = await getRegistrationByUid(
        db,
        options.collectionName,
        uid,
      );
      if (
        existingRegistration &&
        existingRegistration.id !== currentRegistration.id
      ) {
        console.log(
          `[${readerName}] ${uid} is already assigned to ${formatRegistration(existingRegistration)}.`,
        );
        return;
      }

      console.log(
        `[${readerName}] Writing event URL for ${formatRegistration(currentRegistration)} (${uid})...`,
      );
      await writeEventUrl(eventUrl);
      await assignBraceletUid(
        db,
        options.collectionName,
        currentRegistration.id,
        uid,
      );
      console.log(
        `[${readerName}] Assigned ${uid} to ${formatRegistration(currentRegistration)}.`,
      );

      currentRegistration = await getNextUnassignedRegistration(
        db,
        options.collectionName,
      );
      if (!currentRegistration) {
        console.log("All registrations are assigned.");
        return;
      }

      printAssignTarget(currentRegistration);
    },
  });

  registerShutdown(session.close);
}

async function runCheckinMode(
  db: Firestore,
  options: CliOptions,
): Promise<void> {
  const cache = await loadRegistrationCache(db, options.collectionName);
  const syncQueue = createCheckInSyncQueue(db, options.collectionName);

  console.log(`Loaded ${cache.size} assigned bracelets into local cache.`);

  const session = startNfcSession({
    onReaderAttached: (readerName) => {
      console.log(`Reader ready: ${readerName}`);
      console.log("Check-in is live.");
    },
    onReaderDetached: (readerName) => {
      console.log(`Reader removed: ${readerName}`);
    },
    onError: (error) => {
      console.error(`NFC error: ${error.message}`);
    },
    onScan: async ({ readerName, uid }) => {
      const registration = cache.get(uid);

      if (!registration) {
        console.log(`[${readerName}] Unknown bracelet: ${uid}`);
        return;
      }

      if (registration.present) {
        console.log(
          `[${readerName}] Already checked in: ${formatRegistration(registration)} (${uid})`,
        );
        return;
      }

      registration.present = true;
      registration.checkedInAt = new Date().toISOString();
      syncQueue.enqueue(registration);
      console.log(
        `[${readerName}] Checked in ${formatRegistration(registration)} (${uid})`,
      );
    },
  });

  registerShutdown(session.close);
}

function createCheckInSyncQueue(db: Firestore, collectionName: string) {
  const pending = new Map<string, PendingCheckIn>();
  let flushing = false;

  return {
    enqueue(registration: Registration) {
      if (pending.has(registration.id)) {
        return;
      }

      pending.set(registration.id, {
        attempts: 0,
        registrationId: registration.id,
        uid: registration.braceletUid ?? "unknown",
      });

      void flush();
    },
  };

  async function flush(): Promise<void> {
    if (flushing) {
      return;
    }

    flushing = true;

    try {
      while (pending.size > 0) {
        const nextItem = pending.values().next().value as
          | PendingCheckIn
          | undefined;
        if (!nextItem) {
          return;
        }

        try {
          await markRegistrationPresent(
            db,
            collectionName,
            nextItem.registrationId,
          );
          pending.delete(nextItem.registrationId);
        } catch (error) {
          nextItem.attempts += 1;
          const retryDelayMs = Math.min(
            30000,
            1000 * 2 ** Math.min(nextItem.attempts, 5),
          );
          console.error(
            `Firestore sync failed for ${nextItem.uid} (attempt ${nextItem.attempts}). Retrying in ${Math.round(retryDelayMs / 1000)}s: ${toError(error).message}`,
          );
          await sleep(retryDelayMs);
        }
      }
    } finally {
      flushing = false;
    }
  }
}

function parseArgs(argv: string[]): CliOptions {
  const [modeArgument] = argv;
  if (modeArgument !== "assign" && modeArgument !== "checkin") {
    printUsageAndExit();
  }

  const mode = modeArgument as Mode;
  const serviceAccountPath =
    readOption(argv, "--service-account") ??
    process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const collectionName =
    readOption(argv, "--collection") ??
    process.env.FIRESTORE_COLLECTION ??
    "registrations";
  const eventUrl = readOption(argv, "--url") ?? process.env.EVENT_URL;

  return {
    collectionName,
    eventUrl,
    mode,
    serviceAccountPath,
  };
}

function readOption(argv: string[], optionName: string): string | undefined {
  const directIndex = argv.indexOf(optionName);
  if (directIndex >= 0) {
    return argv[directIndex + 1];
  }

  const prefixed = argv.find((value) => value.startsWith(`${optionName}=`));
  return prefixed ? prefixed.slice(optionName.length + 1) : undefined;
}

function printAssignTarget(registration: Registration): void {
  console.log(`Next registration: ${formatRegistration(registration)}`);
}

function registerShutdown(close: () => void): void {
  let shuttingDown = false;

  const handler = (signal: string) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`Received ${signal}. Shutting down.`);
    close();
    process.exit(0);
  };

  process.once("SIGINT", () => {
    handler("SIGINT");
  });

  process.once("SIGTERM", () => {
    handler("SIGTERM");
  });
}

function printUsageAndExit(): never {
  console.log(`Usage:
  node dist/main.js assign --url https://event.example.com
  node dist/main.js checkin

Options:
  --service-account PATH   Firebase service account JSON path (default: ${DEFAULT_SERVICE_ACCOUNT_PATH})
  --collection NAME        Firestore collection name (default: registrations)
  --url URL                Event URL written to each bracelet in assign mode

Environment variables:
  GOOGLE_APPLICATION_CREDENTIALS
  FIRESTORE_COLLECTION
  EVENT_URL
  NFC_MIFARE_KEYS          Comma-separated 12-char MIFARE keys to try first
`);
  process.exit(1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

void main().catch((error) => {
  console.error(toError(error).message);
  process.exit(1);
});
