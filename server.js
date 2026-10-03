const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

app.use(cors());
app.use(express.json());

app.post('/generate-video', async (req, res) => {
    try {
        const { prompt } = req.body;
        const HF_TOKEN = process.env.HF_TOKEN;

        const response = await fetch(
            'https://api-inference.huggingface.co/models/ali-vilab/text-to-video-ms-1.7b',
            {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + HF_TOKEN,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ inputs: prompt })
            }
        );

        const buffer = await response.buffer();
        res.set('Content-Type', 'video/mp4');
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Servidor rodando na porta ' + PORT));
