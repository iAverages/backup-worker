import { RouteHandler } from "itty-router";
import { B2Auth, Data, File, ListBuckets } from "./interface";

const b2Auth = "https://api.backblazeb2.com/b2api/v2/b2_authorize_account";

// Global variables persist until the worker is killed
export const B2 = {
    data: {} as B2Auth,
    // data: {
    //     absoluteMinimumPartSize: 5000000,
    //     accountId: "0d4a4136a009",
    //     allowed: {
    //         bucketId: "e0cd446a94a123067ae00019",
    //         bucketName: "svmc-backups",
    //         capabilities: ["listBuckets", "readBuckets", "listFiles", "readFiles", "shareFiles", "readBucketEncryption"],
    //         namePrefix: null,
    //     },
    //     apiUrl: "https://api002.backblazeb2.com",
    //     authorizationToken: "4_0020d4a4136a009000000000b_01a44414_b8c0e7_acct_t2TT2oVf4lK2pTrtMiJ4OWi8CW0=",
    //     downloadUrl: "https://f002.backblazeb2.com",
    //     recommendedPartSize: 100000000,
    //     s3ApiUrl: "https://s3.us-west-002.backblazeb2.com",
    // } as B2Auth,
    lastRefresh: 0,
};

export async function checkB2Token(): Promise<void> {
    const lastRefresh = (Date.now() - B2.lastRefresh) / 1000;

    // 64800 seconds - 18 hours
    if (B2.data === null || lastRefresh === 0 || lastRefresh > 64800) {
        // Get new token now
        console.log("Refreshing auth token now");
        await refreshB2();
    }

    // If we are unable to get valid auth obj, error
    if (B2.data == null) {
        throw new Error();
    }
}
export async function updateB2Conf(): Promise<void> {
    const time = Date.now();
    const authKey = btoa(`${B2_KEY_ID}:${B2_APP_KEY_ID}`);
    const data = await fetch(b2Auth, { headers: { Authorization: `Basic ${authKey}` } });
    const b2Data: B2Auth = await data.json();
    B2CONF.put("auth", JSON.stringify(b2Data));
    B2.data = b2Data;
    B2.lastRefresh = time;
}

export async function refreshB2(): Promise<void> {
    const data = await B2CONF.get("auth");
    if (data === null) {
        console.log("b2Auth not in KV, fetching now.");
        await updateB2Conf();
    } else {
        B2.data = JSON.parse(data);
        B2.lastRefresh = Date.now();
    }
}

export function removeBzHeaders(headers: Headers): Record<string, string> {
    const newHeaders: Record<string, string> = {};
    headers.forEach((v, k) => {
        if (!k.match(/^x-bz/i)) {
            newHeaders[k] = v;
        }
    });
    return newHeaders;
}

export function res(response: string | Record<string, unknown>, other?: ResponseInit): Response {
    let data = "";
    if (typeof response === "object") {
        data = JSON.stringify(response);
    } else {
        data = response;
    }
    return new Response(data, other);
}

export const catchAsync =
    <T extends Request>(fn: (request: T, ...args: unknown[]) => unknown): RouteHandler<T> =>
    async (req: T) => {
        try {
            return await Promise.resolve(fn(req));
        } catch (_e: unknown) {
            const e = _e as Error;
            console.log(e.message);
            return res({ success: false, message: "An error has occured" }, { status: 500 });
        }
    };

export async function getB2FileInfo(data: Data): Promise<Response> {
    if (data.id) {
        return sendB2Req(`${B2.data.apiUrl}/b2api/v2/b2_get_file_info?fileId=${data.id}`);
    } else if (data.name) {
        const split = data.name.split("/");
        console.log(split);
        const bucket = split[0];
        const name = split?.splice(1);
        const bucketId = await getBucketId(bucket);
        const res = await sendB2Req(
            `${B2.data.apiUrl}/b2api/v2/b2_list_file_names?bucketId=${bucketId}&prefix=${encodeURIComponent(name.join("/"))}`,
        );
        const { files } = await res.json<{ files: File[] }>();
        console.log(files);
        if (!files || files.length < 1) {
            return new Response("", { status: 400 });
        }
        return getB2FileInfo({ id: files[0].fileId });
    } else {
        return new Response("", { status: 400 });
    }
}

export async function getBucketId(name: string): Promise<string> {
    const data = await sendB2Req(
        `${B2.data.apiUrl}/b2api/v2/b2_list_buckets?bucketName=${encodeURIComponent(name)}&accountId=${B2_ACCOUNT_ID}`,
    );
    const { buckets } = await data.json<ListBuckets>();
    return buckets[0].bucketId;
}

export async function getB2File(id: string): Promise<Response> {
    return sendB2Req(`${B2.data.downloadUrl}/b2api/v2/b2_download_file_by_id?fileId=${id}`);
}

export function getB2FileHist(fileInfo: File): Promise<Response> {
    const { bucketId, fileName } = fileInfo;
    return sendB2Req(`${B2.data.apiUrl}/b2api/v2/b2_list_file_versions?bucketId=${bucketId}&prefix=${fileName}`);
}

async function sendB2Req(url: string, data: RequestInit = {}, _repeated = false): Promise<Response> {
    console.log(`[B2] Sending Request: ${url}`);
    const res = await fetch(url, { ...data, headers: { Authorization: B2.data.authorizationToken } });
    if (res.status === 401) {
        if (_repeated) {
            console.error("Failed B2 Authentication");
            throw new Error("Authentication Failed");
        }
        console.log("Auth token was exipred");
        await updateB2Conf();
        return sendB2Req(url, data, true);
    } else {
        return res;
    }
}
