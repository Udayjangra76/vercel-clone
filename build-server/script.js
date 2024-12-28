import path from 'path'
import { exec } from 'child_process'
import fs from 'fs'
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import mime from 'mime-types'
import { fileURLToPath } from 'url'
import { Kafka } from 'kafkajs'

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
const DEPLOYEMENT_ID = process.env.DEPLOYEMENT_ID


const kafka = new Kafka({
    clientId: `docker-build-server-${DEPLOYEMENT_ID}`,
    brokers: [''],
    ssl: {
        ca: [fs.readFileSync(path.join(__dirname, 'kafka.pem'), 'utf-8')]
    },
    sasl: {
        username: '',
        password: '',
        mechanism: ''
    }

})

const producer = kafka.producer()

async function publishLog(log) {
    await producer.send({ topic: `container-logs`, messages: [{ key: 'log', value: JSON.stringify({ PROJECT_ID, DEPLOYEMENT_ID, log }) }] })
}

async function init() {

    await producer.connect()

    console.log("Executing script.js")

    await publishLog('Build Started...')
    const outDirPath = path.join(__dirname, 'output')
    const p = exec(`cd ${outDirPath} && npm install && npm run build`)

    p.stdout.on('data', async function (data) {
        console.log(data.toString())
        await publishLog(data.toString())
    })

    p.stderr.on('error', async function (data) {
        console.log('Error', data.toString())
        await publishLog(`error: ${data.toString()}`)
    })

    p.on('close', async function () {
        console.log('Build Complete')
        await publishLog(`Build Complete`)

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
        await publishLog(`Starting to upload`)

        for (const file of BuildFolderContent) {
            const filePath = path.join(outputFolderPath, file)
            if (fs.lstatSync(filePath).isDirectory()) continue

            console.log('uploading', filePath)
            await publishLog(`uploading ${file}`)
            const command = new PutObjectCommand({
                Bucket: 'vercel.clone.output',
                Key: `__output/${PROJECT_ID}/${file}`,
                Body: fs.createReadStream(filePath),
                ContentType: mime.lookup(filePath)
            })

            await s3Client.send(command);
            console.log('uploaded', filePath)
            await publishLog(`uploaded ${file}`)
        }
        await publishLog(`Done`)
        console.log('Done...')
        process.exit(0);
    })
}

init();