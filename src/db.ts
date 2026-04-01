import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import {
  FieldValue,
  getFirestore,
  Timestamp,
  type Firestore,
} from "firebase-admin/firestore";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const DEFAULT_SERVICE_ACCOUNT_PATH =
  "./nfcc-8a2e5-firebase-adminsdk-fbsvc-ce0d91f4e3.json";

export interface Registration {
  id: string;
  name: string | null;
  email: string | null;
  braceletUid: string | null;
  present: boolean;
  checkedInAt: string | null;
}

export interface FirestoreConfig {
  collectionName: string;
  serviceAccountPath?: string;
}

export function initFirestore(config: FirestoreConfig): Firestore {
  const serviceAccountPath =
    config.serviceAccountPath ??
    process.env.GOOGLE_APPLICATION_CREDENTIALS ??
    getLocalDefaultServiceAccountPath();

  if (serviceAccountPath) {
    const resolvedPath = resolve(serviceAccountPath);
    if (!existsSync(resolvedPath)) {
      throw new Error(`Service account file not found: ${resolvedPath}`);
    }

    process.env.GOOGLE_APPLICATION_CREDENTIALS = resolvedPath;
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      "Set --service-account or GOOGLE_APPLICATION_CREDENTIALS before starting the CLI.",
    );
  }

  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault() });
  }

  return getFirestore();
}

function getLocalDefaultServiceAccountPath(): string | undefined {
  const resolvedPath = resolve(DEFAULT_SERVICE_ACCOUNT_PATH);
  return existsSync(resolvedPath) ? resolvedPath : undefined;
}

export async function getNextUnassignedRegistration(
  db: Firestore,
  collectionName: string,
): Promise<Registration | null> {
  const snapshot = await db
    .collection(collectionName)
    .where("braceletUid", "==", null)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return mapRegistration(
    snapshot.docs[0].id,
    snapshot.docs[0].data() as Record<string, unknown>,
  );
}

export async function getRegistrationByUid(
  db: Firestore,
  collectionName: string,
  uid: string,
): Promise<Registration | null> {
  const snapshot = await db
    .collection(collectionName)
    .where("braceletUid", "==", uid)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return mapRegistration(
    snapshot.docs[0].id,
    snapshot.docs[0].data() as Record<string, unknown>,
  );
}

export async function assignBraceletUid(
  db: Firestore,
  collectionName: string,
  registrationId: string,
  uid: string,
): Promise<void> {
  await db
    .collection(collectionName)
    .doc(registrationId)
    .update({ braceletUid: uid });
}

export async function markRegistrationPresent(
  db: Firestore,
  collectionName: string,
  registrationId: string,
): Promise<void> {
  await db.collection(collectionName).doc(registrationId).update({
    present: true,
    checkedInAt: FieldValue.serverTimestamp(),
  });
}

export async function loadRegistrationCache(
  db: Firestore,
  collectionName: string,
): Promise<Map<string, Registration>> {
  const snapshot = await db.collection(collectionName).get();
  const cache = new Map<string, Registration>();

  for (const doc of snapshot.docs) {
    const registration = mapRegistration(
      doc.id,
      doc.data() as Record<string, unknown>,
    );
    if (registration.braceletUid) {
      cache.set(registration.braceletUid, registration);
    }
  }

  return cache;
}

export function formatRegistration(registration: Registration): string {
  const name = registration.name ?? "Unnamed registration";
  const email = registration.email ?? "no-email";
  return `${name} <${email}>`;
}

function mapRegistration(
  id: string,
  data: Record<string, unknown>,
): Registration {
  return {
    id,
    name: typeof data.name === "string" ? data.name : null,
    email: typeof data.email === "string" ? data.email : null,
    braceletUid: typeof data.braceletUid === "string" ? data.braceletUid : null,
    present: data.present === true,
    checkedInAt:
      data.checkedInAt instanceof Timestamp
        ? data.checkedInAt.toDate().toISOString()
        : null,
  };
}
