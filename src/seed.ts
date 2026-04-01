import { DEFAULT_SERVICE_ACCOUNT_PATH, initFirestore } from "./db";

interface SeedOptions {
  collectionName: string;
  count: number;
  serviceAccountPath?: string;
}

const FIRST_NAMES = [
  "Youssef",
  "Salma",
  "Omar",
  "Nour",
  "Rania",
  "Karim",
  "Maya",
  "Adam",
  "Lina",
  "Samir",
];

const LAST_NAMES = [
  "Bennani",
  "Alaoui",
  "El Idrissi",
  "Amrani",
  "Skalli",
  "Tazi",
  "Kadiri",
  "Mansouri",
  "Cherkaoui",
  "Lahlou",
];

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const db = initFirestore({
    collectionName: options.collectionName,
    serviceAccountPath: options.serviceAccountPath,
  });

  const batch = db.batch();
  const collection = db.collection(options.collectionName);

  for (let index = 0; index < options.count; index += 1) {
    const registration = buildSeedRegistration(index);
    batch.set(collection.doc(), registration);
  }

  await batch.commit();
  console.log(
    `Seeded ${options.count} test registrations into ${options.collectionName}.`,
  );
}

function parseArgs(argv: string[]): SeedOptions {
  const serviceAccountPath =
    readOption(argv, "--service-account") ??
    process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const collectionName =
    readOption(argv, "--collection") ??
    process.env.FIRESTORE_COLLECTION ??
    "registrations";
  const countArgument = readOption(argv, "--count");
  const count = countArgument ? Number.parseInt(countArgument, 10) : 10;

  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("--count must be a positive integer.");
  }

  return {
    collectionName,
    count,
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

function buildSeedRegistration(index: number) {
  const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
  const lastName =
    LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length];
  const sequence = String(index + 1).padStart(3, "0");
  const name = `${firstName} ${lastName}`;
  const emailSlug = `${firstName}.${lastName}.${sequence}`
    .toLowerCase()
    .replace(/\s+/g, "-");

  return {
    braceletUid: null,
    checkedInAt: null,
    email: `${emailSlug}@example.com`,
    name,
    present: false,
  };
}

function printUsageAndExit(): never {
  console.log(`Usage:
  node dist/seed.js
  node dist/seed.js --count 25
  node dist/seed.js --collection registrations_test --count 10

Options:
  --service-account PATH   Firebase service account JSON path (default: ${DEFAULT_SERVICE_ACCOUNT_PATH})
  --collection NAME        Firestore collection name (default: registrations)
  --count NUMBER           Number of test registrations to create (default: 10)
`);
  process.exit(1);
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printUsageAndExit();
}

void main().catch((error) => {
  console.error(toError(error).message);
  process.exit(1);
});
