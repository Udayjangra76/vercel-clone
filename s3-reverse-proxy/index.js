import express from 'express'
import httpProxy from 'http-proxy'

const BASE_PATH = 'https://s3.ap-south-1.amazonaws.com/vercel.clone.output/__output'

const app = express()
const PORT = 8000

const proxy = httpProxy.createProxy()

app.use((req, res) => {
    const hostname = req.hostname
    const subdomain = hostname.split('.')[0]

    const resolveTo = `${BASE_PATH}/${subdomain}`

    return proxy.web(req, res, { target: resolveTo, changeOrigin: true })
})

proxy.on('proxyReq', (proxyReq, req, res) => {
    const url = req.url;
    if (url === '/')
        proxyReq.path += 'index.html'

})
app.listen(PORT, () => console.log(`Reverse Proxy Running..${PORT}`))