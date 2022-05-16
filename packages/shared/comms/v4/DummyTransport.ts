import { Transport } from './Transport'

export class DummyTransport extends Transport {
  async connect(): Promise<void> { }
  async send(): Promise<void> { }
  async disconnect(): Promise<void> { }
}
