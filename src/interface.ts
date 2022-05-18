export interface KVStore {
    get: (key: string) => Promise<string>;
    put: (key: string, value: string) => void;
}

declare global {
    const B2CONF: KVStore;
    const B2ACCESS: string;
    const SECRET: string;
    const API_TOKEN: string;
    const B2_ACCOUNT_ID: string;
    const B2_KEY_ID: string;
    const B2_APP_KEY_ID: string;
}

export interface IRequest extends Request {
    params: Params;
    headers: Headers;
}

export interface Params {
    token: string;
}

export interface Data {
    id?: string;
    name?: string;
}

export interface B2AuthObj {
    absoluteMinimumPartSize: number;
    accountId: string;
    allowed: {
        bucketId: string;
        bucketName: string;
        capabilities: string[];
        namePrefix: null;
    };
    apiUrl: string;
    authorizationToken: string;
    downloadUrl: string;
    recommendedPartSize: number;
    s3ApiUrl: string;
}

export type B2Auth = B2AuthObj;

export interface File {
    bucketId: string;
    fileName: string;
    fileId: string;
    uploadTimestamp: number;
    contentType: string;
    contentSha1: string;
    contentMd5: string;
    contentLength: string;
}

export interface FileHist {
    files: File[];
}

export interface FileInfo {
    id: string;
    bucketId: string;
    fileName: string;
    uploadTimestamp: number;
    type: string;
    sha1: string;
    md5: string;
    size: string;
}

export interface Bucket {
    bucketId: string;
}

export interface ListBuckets {
    buckets: Bucket[];
}
