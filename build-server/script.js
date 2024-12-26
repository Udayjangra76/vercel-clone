import path from 'path'
import { exec } from 'child_process'
import fs from 'fs'
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import mime from 'mime-types'
import { fileURLToPath } from 'url';
import Redis from 'ioredis'

const publisher = new Redis('')

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
console.log(__dirname)
const s3Client = new S3Client({
    region: '',
    credentials: {
        accessKeyId: '',
        secretAccessKey: ''
    }
})

const PROJECT_ID = process.env.PROJECT_ID
function publishLog(log) {
    publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log }))
}

async function init() {
    console.log("Executing script.js")

    publishLog('Build Started...')
    const outDirPath = path.join(__dirname, 'output')
    const p = exec(`cd ${outDirPath} && npm install && npm run build`)

    p.stdout.on('data', function (data) {
        console.log(data.toString())
        publishLog(data.toString())
    })

    p.stderr.on('error', function (data) {
        console.log('Error', data.toString())
        publishLog(`error: ${data.toString()}`)
    })

    p.on('close', async function () {
        console.log('Build Complete')
        publishLog(`Build Complete`)

        const distFolderPath = path.join(__dirname, 'output', 'dist')
        const buildFolderPath = path.join(__dirname, 'output', 'build')
        console.log(distFolderPath);
        console.log(buildFolderPath);
        let outputFolderPath = "";
        if (fs.existsSync(distFolderPath)) {
            outputFolderPath = distFolderPath;
        } else if (fs.existsSync(buildFolderPath)) {
            outputFolderPath = buildFolderPath;
        } else {
            console.error('Error: Neither "dist" nor "build" folder found.');
            return;
        }

        const BuildFolderContent = fs.readdirSync(outputFolderPath, { recursive: true })
        publishLog(`Starting to upload`)

        for (const file of BuildFolderContent) {
            const filePath = path.join(outputFolderPath, file)
            if (fs.lstatSync(filePath).isDirectory()) continue

            console.log('uploading', filePath)
            publishLog(`uploading ${file}`)
            const command = new PutObjectCommand({
                Bucket: 'vercel.clone.output',
                Key: `__output/${PROJECT_ID}/${file}`,
                Body: fs.createReadStream(filePath),
                ContentType: mime.lookup(filePath)
            })

            await s3Client.send(command);
            console.log('uploaded', filePath)
            publishLog(`uploaded ${file}`)
        }
        publishLog(`Done`)
        console.log('Done...')
    })
}

init();