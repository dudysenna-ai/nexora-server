const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => {
    res.json({ status: 'online', service: 'NEXORA AI Server', version: '4.0.0' });
});

app.post('/api/generate-video', async (req, res) => {
    try {
        const { prompt, aspect_ratio, style, camera, mode } = req.body;
        if (!prompt && mode !== 'image') return res.status(400).json({ error: 'Prompt obrigatorio.' });

        let fullPrompt = prompt || '';
        if (style) fullPrompt += ', ' + style + ' style';
        if (camera) fullPrompt += ', ' + camera + ' camera';
        fullPrompt += ', high quality, detailed, professional';

        const encoded = encodeURIComponent(fullPrompt);
        const videoUrl = 'https://gen.pollinations.ai/video/' + encoded + '?model=free&duration=4&nologo=true';

        console.log('[NEXORA] Gerando video via Pollinations (gratuito)');
        console.log('[NEXORA] Prompt:', fullPrompt);

        return res.json({
            success: true,
            videoUrl: videoUrl,
            status: 'ready',
            model: 'Pollinations Free'
        });

    } catch (error) {
        console.error('[NEXORA] Erro:', error.message);
        res.status(500).json({ error: 'Erro interno.', details: error.message });
    }
});

app.get('/api/prediction/:id', (req, res) => {
    res.json({ status: 'not_needed', message: 'Pollinations retorna URL direta.' });
});

app.post('/api/prediction/:id/cancel', (req, res) => {
    res.json({ success: true });
});

app.post('/api/enhance-prompt', (req, res) => {
    res.json({ enhanced: req.body.prompt });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[NEXORA] Rodando na porta ' + PORT));
