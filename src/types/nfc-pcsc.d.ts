declare module "nfc-pcsc" {
  import { EventEmitter } from "node:events";

  export const TAG_ISO_14443_3: string;
  export const TAG_ISO_14443_4: string;
  export const KEY_TYPE_A: number;
  export const KEY_TYPE_B: number;

  export interface Card {
    atr?: Buffer;
    data?: Buffer;
    standard?: string;
    type?: string;
    uid?: string;
  }

  export interface Reader extends EventEmitter {
    autoProcessing: boolean;
    name: string;
    authenticate(
      blockNumber: number,
      keyType: number,
      key: string | Buffer | number[],
      obsolete?: boolean,
    ): Promise<boolean>;
    read(
      blockNumber: number,
      length: number,
      blockSize?: number,
      packetSize?: number,
      readClass?: number,
    ): Promise<Buffer>;
    write(
      blockNumber: number,
      data: Buffer,
      blockSize?: number,
    ): Promise<unknown>;
    on(event: "card", listener: (card: Card) => void | Promise<void>): this;
    on(event: "card.off", listener: (card: Card) => void): this;
    on(event: "error", listener: (error: Error) => void): this;
    on(event: "end", listener: () => void): this;
  }

  export class NFC extends EventEmitter {
    constructor(logger?: unknown);
    close(): void;
    on(event: "reader", listener: (reader: Reader) => void): this;
    on(event: "error", listener: (error: Error) => void): this;
  }
}
