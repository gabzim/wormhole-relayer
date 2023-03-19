/// <reference types="node" />
import { Job, Queue, Worker } from "bullmq";
import { RelayerApp } from "./application";
import { Context } from "./context";
import { Logger } from "winston";
import { ClusterNode, ClusterOptions, RedisOptions } from "ioredis";
export interface StorageContext extends Context {
    storage: {
        job: Job;
        worker: Worker;
    };
}
export interface StorageOptions {
    redisClusterEndpoints?: ClusterNode[];
    redisCluster?: ClusterOptions;
    redis?: RedisOptions;
    queueName: string;
    attempts: number;
    namespace?: string;
    concurrency?: number;
}
export type JobData = {
    parsedVaa: any;
    vaaBytes: string;
};
export type JobBatchData = {
    parsedVaas: any[];
    vaaBytes: string;
};
export declare class Storage<T extends Context> {
    private relayer;
    private opts;
    logger: Logger;
    vaaQueue: Queue<JobData, string[], string>;
    batchVaaQueue: Queue<JobBatchData, string[], string>;
    private worker;
    private readonly prefix;
    private readonly redis;
    private batchWorker;
    constructor(relayer: RelayerApp<T>, opts: StorageOptions);
    addVaaToQueue(vaaBytes: Buffer): Promise<Job<JobData, string[], string>>;
    addBatchVaaToQueue(vaa: Buffer): Promise<Job<JobBatchData, string[], string>>;
    private vaaId;
    startWorker(): void;
    startBatchWorker(): void;
    stopWorker(): Promise<void>;
}
