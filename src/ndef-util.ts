const URI_PREFIXES = [
  "",
  "http://www.",
  "https://www.",
  "http://",
  "https://",
  "tel:",
  "mailto:",
  "ftp://anonymous:anonymous@",
  "ftp://ftp.",
  "ftps://",
  "sftp://",
  "smb://",
  "nfs://",
  "ftp://",
  "dav://",
  "news:",
  "telnet://",
  "imap:",
  "rtsp://",
  "urn:",
  "pop:",
  "sip:",
  "sips:",
  "tftp:",
  "btspp://",
  "btl2cap://",
  "btgoep://",
  "tcpobex://",
  "irdaobex://",
  "file://",
  "urn:epc:id:",
  "urn:epc:tag:",
  "urn:epc:pat:",
  "urn:epc:raw:",
  "urn:epc:",
  "urn:nfc:",
] as const;

const NDEF_MESSAGE_TLV = 0x03;
const NDEF_TERMINATOR_TLV = 0xfe;
const NDEF_URI_RECORD_TYPE = 0x55;
const NDEF_WELL_KNOWN_TNF = 0x01;
const NDEF_MB = 0x80;
const NDEF_ME = 0x40;
const NDEF_SR = 0x10;

export function buildUriRecord(uri: string): Buffer {
  if (!uri) {
    throw new Error("Event URL is required.");
  }

  const prefixCode = URI_PREFIXES.findIndex(
    (prefix) => prefix !== "" && uri.startsWith(prefix),
  );
  const matchedPrefix = prefixCode >= 0 ? URI_PREFIXES[prefixCode] : "";
  const encodedUri = uri.slice(matchedPrefix.length);
  const payload = Buffer.concat([
    Buffer.from([prefixCode >= 0 ? prefixCode : 0]),
    Buffer.from(encodedUri, "utf8"),
  ]);

  if (payload.length > 255) {
    throw new Error("Event URL is too long for a short NDEF URI record.");
  }

  return Buffer.concat([
    Buffer.from([
      NDEF_MB | NDEF_ME | NDEF_SR | NDEF_WELL_KNOWN_TNF,
      0x01,
      payload.length,
      NDEF_URI_RECORD_TYPE,
    ]),
    payload,
  ]);
}

export function buildNdefTlv(message: Buffer): Buffer {
  if (message.length < 255) {
    return Buffer.concat([
      Buffer.from([NDEF_MESSAGE_TLV, message.length]),
      message,
      Buffer.from([NDEF_TERMINATOR_TLV]),
    ]);
  }

  return Buffer.concat([
    Buffer.from([
      NDEF_MESSAGE_TLV,
      0xff,
      (message.length >> 8) & 0xff,
      message.length & 0xff,
    ]),
    message,
    Buffer.from([NDEF_TERMINATOR_TLV]),
  ]);
}

export function buildPaddedNdefPayload(uri: string, blockSize: number): Buffer {
  const tlv = buildNdefTlv(buildUriRecord(uri));
  const remainder = tlv.length % blockSize;

  if (remainder === 0) {
    return tlv;
  }

  return Buffer.concat([tlv, Buffer.alloc(blockSize - remainder, 0x00)]);
}
