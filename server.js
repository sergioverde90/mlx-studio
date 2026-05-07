const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = process.env.API_BASE_URL || 'http://localhost:8080/v1/chat/completions';

app.use(express.static(path.join(__dirname)));

// Serve index.html for root path to support SPA navigation
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('No index.html found. Please place your static files in the server root.');
    }
});

// Reverse proxy for API requests to avoid CORS issues
app.post('/v1/chat/completions', async (req, res) => {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body),
            signal: AbortSignal.timeout(30000) // 30 second timeout for non-streaming requests
        });

        const contentType = response.headers.get('content-type') || '';
        
        if (contentType.includes('text/event-stream')) {
            res.set({
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });

            const reader = response.body.getReader();
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                res.write(value);
            }
            
            res.end();
        } else {
            const data = await response.json().catch(() => null);
            res.status(response.status).json(data || {});
        }
    } catch (err) {
        console.error('Proxy error:', err.message);
        
        if (!res.headersSent && !req.socket.destroyed) {
            // For streaming requests, we need to end the response even on error
            res.end();
        } else if (!res.writableEnded) {
            res.status(502).json({ 
                error: 'Proxy failed',
                message: `Could not connect to API at ${API_URL}. Make sure your MLX server is running.`
            });
        }
    }
});

app.listen(PORT, () => {
    console.log(`TARS running on http://localhost:${PORT}`);
    console.log(`Proxying API requests to: ${API_URL}`);
});
