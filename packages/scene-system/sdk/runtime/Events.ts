export type RuntimeEvent = { type: string; data: any }
export type RuntimeEventCallback = (event: RuntimeEvent) => void
