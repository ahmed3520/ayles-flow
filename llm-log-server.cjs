// Tiny server that appends LLM request logs to .llm-logs/requests.jsonl
// Usage: node llm-log-server.cjs

const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = 3099
const DIR = path.join(__dirname, '.llm-logs')
const FILE = path.join(DIR, 'requests.jsonl')
fs.mkdirSync(DIR, { recursive: true })

// Clear on start
fs.writeFileSync(FILE, '')
console.log(`Cleared ${FILE}`)

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/log') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try {
        fs.appendFileSync(FILE, body + '\n')
        const parsed = JSON.parse(body)
        console.log(`#${parsed.idx} | ${parsed.msgCount} msgs`)
        res.writeHead(200)
        res.end('ok')
      } catch (err) {
        console.error('write error:', err.message)
        res.writeHead(500)
        res.end('error')
      }
    })
  } else {
    res.writeHead(404)
    res.end()
  }
})

server.listen(PORT, () => {
  console.log(`LLM log server on http://localhost:${PORT}`)
  console.log(`Appending to ${FILE}`)
})
