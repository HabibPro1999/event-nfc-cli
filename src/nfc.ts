import {
  KEY_TYPE_A,
  KEY_TYPE_B,
  NFC,
  TAG_ISO_14443_3,
  type Card,
  type Reader,
} from "nfc-pcsc";
import { buildPaddedNdefPayload } from "./ndef-util";

const MIFARE_CLASSIC_BLOCK_SIZE = 16;
const FIRST_NDEF_DATA_BLOCK = 4;
const BLOCKS_PER_SECTOR = 4;
const MAX_BLOCK_NUMBER = 63;
const DEFAULT_MIFARE_KEYS = ["D3F7D3F7D3F7", "FFFFFFFFFFFF", "A0A1A2A3A4A5"];

export interface ScanEvent {
  readerName: string;
  uid: string;
  writeEventUrl: (url: string) => Promise<void>;
}

export interface NfcSession {
  close: () => void;
}

export interface NfcSessionHandlers {
  onReaderAttached?: (readerName: string) => void;
  onReaderDetached?: (readerName: string) => void;
  onScan: (event: ScanEvent) => Promise<void> | void;
  onError?: (error: Error) => void;
}

export function startNfcSession(handlers: NfcSessionHandlers): NfcSession {
  const nfc = new NFC();

  nfc.on("reader", (reader) => {
    let busy = false;

    handlers.onReaderAttached?.(reader.name);

    reader.on("card", async (card) => {
      if (busy) {
        return;
      }

      busy = true;

      try {
        const uid = normalizeUid(card.uid);
        if (!uid) {
          throw new Error(
            `Reader ${reader.name} detected a card without a UID.`,
          );
        }

        await handlers.onScan({
          readerName: reader.name,
          uid,
          writeEventUrl: async (url: string) => {
            await writeEventUrlToCard(reader, card, url);
          },
        });
      } catch (error) {
        handlers.onError?.(toError(error));
      } finally {
        busy = false;
      }
    });

    reader.on("error", (error) => {
      handlers.onError?.(toError(error));
    });

    reader.on("end", () => {
      handlers.onReaderDetached?.(reader.name);
    });
  });

  nfc.on("error", (error) => {
    handlers.onError?.(toError(error));
  });

  return {
    close: () => {
      nfc.close();
    },
  };
}

export function normalizeUid(rawUid?: string): string | null {
  if (!rawUid) {
    return null;
  }

  const hex = rawUid.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (hex.length === 0 || hex.length % 2 !== 0) {
    return null;
  }

  const parts = hex.match(/.{1,2}/g);
  return parts ? parts.join(":") : null;
}

async function writeEventUrlToCard(
  reader: Reader,
  card: Card,
  url: string,
): Promise<void> {
  if (card.type !== TAG_ISO_14443_3) {
    throw new Error(
      `Reader ${reader.name} detected ${card.type ?? "an unknown card type"}. MIFARE Classic tags are required for writing.`,
    );
  }

  const payload = buildPaddedNdefPayload(url, MIFARE_CLASSIC_BLOCK_SIZE);
  const blocks = getWritableBlocks(payload.length);
  let lastAuthenticatedSector = -1;

  for (let index = 0; index < blocks.length; index += 1) {
    const blockNumber = blocks[index];
    const sector = Math.floor(blockNumber / BLOCKS_PER_SECTOR);

    if (sector !== lastAuthenticatedSector) {
      await authenticateSectorForWrite(reader, blockNumber);
      lastAuthenticatedSector = sector;
    }

    const start = index * MIFARE_CLASSIC_BLOCK_SIZE;
    const end = start + MIFARE_CLASSIC_BLOCK_SIZE;
    await reader.write(
      blockNumber,
      payload.slice(start, end),
      MIFARE_CLASSIC_BLOCK_SIZE,
    );
  }
}

async function authenticateSectorForWrite(
  reader: Reader,
  blockNumber: number,
): Promise<void> {
  const keys = getCandidateKeys();

  for (const keyType of [KEY_TYPE_B, KEY_TYPE_A]) {
    for (const key of keys) {
      try {
        await reader.authenticate(blockNumber, keyType, key);
        return;
      } catch {
        // Try the next common MIFARE key.
      }
    }
  }

  throw new Error(
    `Unable to authenticate sector for block ${blockNumber}. Set NFC_MIFARE_KEYS if your bracelets use non-default keys.`,
  );
}

function getCandidateKeys(): string[] {
  const configuredKeys = (process.env.NFC_MIFARE_KEYS ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => /^[A-F0-9]{12}$/.test(value));

  return [...new Set([...configuredKeys, ...DEFAULT_MIFARE_KEYS])];
}

function getWritableBlocks(byteLength: number): number[] {
  const blockCount = Math.ceil(byteLength / MIFARE_CLASSIC_BLOCK_SIZE);
  const blocks: number[] = [];
  let blockNumber = FIRST_NDEF_DATA_BLOCK;

  while (blocks.length < blockCount) {
    if (blockNumber > MAX_BLOCK_NUMBER) {
      throw new Error(
        "The NDEF payload is too large for a MIFARE Classic 1K bracelet.",
      );
    }

    if (!isSectorTrailerBlock(blockNumber)) {
      blocks.push(blockNumber);
    }

    blockNumber += 1;
  }

  return blocks;
}

function isSectorTrailerBlock(blockNumber: number): boolean {
  return (blockNumber + 1) % BLOCKS_PER_SECTOR === 0;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
