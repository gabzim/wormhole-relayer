import * as wormholeSdk from "@certusone/wormhole-sdk";
import { SignedVaa } from "@certusone/wormhole-sdk";
import { ParsedVaaWithBytes } from "./application";
export declare function encodeEmitterAddress(chainId: wormholeSdk.ChainId, emitterAddressStr: string): string;
export declare function sleep(ms: number): Promise<unknown>;
/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
export declare function isObject(item: any): boolean;
export declare function parseVaaWithBytes(bytes: SignedVaa): ParsedVaaWithBytes;
/**
 * Deep merge two objects.
 * @param target
 * @param ...sources
 */
export declare function mergeDeep<T>(target: Partial<T>, ...sources: Partial<T>[]): T;
