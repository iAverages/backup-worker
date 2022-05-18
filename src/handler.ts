import { Router } from "itty-router";
import { Data, FileHist, File, IRequest, FileInfo } from "./interface";
import jwt from "@tsndr/cloudflare-worker-jwt";
import { catchAsync, checkB2Token, getB2File, getB2FileHist, getB2FileInfo, removeBzHeaders, res } from "./utils";

export const router = Router();

router.all("*", () => checkB2Token());

// Download file
router.get(
    "/file/:token",
    catchAsync<IRequest>(async ({ params }) => {
        const { token } = params;

        if (!(await jwt.verify(token, SECRET))) {
            return res({ success: false, message: "Invalid token" }, { status: 400 });
        }

        const data: Data | null = jwt.decode(token) as Data;
        if (!(data && data.id)) {
            return res({ success: false, message: "Invalid token" }, { status: 400 });
        }

        let response = await getB2File(data.id);
        const fileNameParts = response.headers.get("X-Bz-File-Name")?.split("/");
        const fileName = fileNameParts?.at(-1);

        // remove Backblaze headers
        response = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: {
                ...removeBzHeaders(response.headers),
                "Content-Disposition": `attachment; filename="${fileName ?? data.id}"`,
            },
        });

        return response;
    }),
);

// Apply API Key Auth
router.post<IRequest>("*", (req) => {
    const auth = req.headers.get("Authorization")?.split(" ")[1];
    if (auth !== API_TOKEN) {
        return res({ success: false, message: "Unauthorized" }, { status: 401 });
    }
});

// Create JWT for backup download
router.post(
    "/api/create",
    catchAsync(async (req) => {
        let json;
        try {
            json = await req.json<Data>();
        } catch (e) {
            json = null;
        }

        if (!json?.id) {
            return res({ success: false, message: "No ID specified" }, { status: 400 });
        }

        const file = await getB2FileInfo(json);

        if (file.status !== 200) {
            return res({ success: false, message: "ID Not Found" }, { status: 404 });
        }

        const token = await jwt.sign(
            {
                id: json.id,
                exp: Math.floor(Date.now() / 1000) + 2 * (60 * 60), // Expires: Now + 2h
            },
            SECRET,
        );

        return res({ success: true, token });
    }),
);

// List all backups for file
router.post(
    "/api/list",
    catchAsync(async (req) => {
        let json;
        try {
            json = await req.json<Data>();
        } catch (e) {
            json = null;
        }

        if (!json?.id && !json?.name) {
            return res({ success: false, message: "No ID or Name specified" }, { status: 400 });
        }

        const file = await getB2FileInfo(json);

        if (file.status !== 200) {
            return res({ success: false, message: "ID Not Found" }, { status: 404 });
        }
        const fileInfo = await file.json<File>();
        const fileHist = await getB2FileHist(fileInfo);
        const { files } = await fileHist.json<FileHist>();
        const toSend: FileInfo[] = [];
        files.forEach((f) => {
            toSend.push({
                id: f.fileId,
                bucketId: f.bucketId,
                fileName: f.fileName,
                uploadTimestamp: f.uploadTimestamp,
                type: f.contentType,
                sha1: f.contentSha1,
                md5: f.contentMd5,
                size: f.contentLength,
            });
        });

        return res({ success: true, files: toSend });
    }),
);

// Catch all route
router.all("*", () => res({ success: false, message: "404, not found" }, { status: 404 }));
