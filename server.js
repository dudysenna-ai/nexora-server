const express = require('express');
const cors = require('cors');
const Replicate = require('replicate');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

app.get('/', (req, res) => {
    res.json({ status: 'online', service: 'NEXORA AI Server', version: '3.0.0' });
});

app.post('/api/generate-video', async (req, res) => {
    try {
        const { prompt, aspect_ratio, duration, style, camera, mode, image_url } = req.body;
        if (!prompt && mode !== 'image') return res.status(400).json({ error: 'Prompt obrigatorio.' });

        let width = 848, height = 480;
        if (aspect_ratio === '9:16') { width = 480; height = 848; }
        else if (aspect_ratio === '1:1') { width = 640; height = 640; }

        let fullPrompt = prompt || '';
        if (style) fullPrompt += ', ' + style + ' style';
        if (camera) fullPrompt += ', ' + camera + ' camera';
        fullPrompt += ', high quality, detailed, professional';

        const seedVal = Math.floor(Math.random() * 999999);
        let model, input;

        if (mode === 'image' && image_url) {
            model = 'wan-ai/wan2.1-i2v-14b-480p';
            input = { prompt: fullPrompt, image: image_url, max_area: '832x480', num_frames: 81, seed: seedVal, guidance_scale: 5, num_inference_steps: 28 };
        } else {
            model = 'wan-ai/wan2.1-t2v-14b';
            input = { prompt: fullPrompt, max_area: width + 'x' + height, num_frames: 81, seed: seedVal, guidance_scale: 5, num_inference_steps: 30 };
        }

        const prediction = await replicate.predictions.create({ model: model, input: input });
        res.json({ success: true, predictionId: prediction.id, status: prediction.status, model: model });
    } catch (error) {
        console.error('[NEXORA] Erro:', error.message);
        res.status(500).json({ error: 'Erro ao criar predicao.', details: error.message });
    }
});

app.get('/api/prediction/:id', async (req, res) => {
    try {
        const prediction = await replicate.predictions.get(req.params.id);
        let videoUrl = null;
        if (prediction.status === 'succeeded' && prediction.output) {
            if (typeof prediction.output === 'string') videoUrl = prediction.output;
            else if (Array.isArray(prediction.output)) videoUrl = prediction.output[0];
        }
        res.json({ id: prediction.id, status: prediction.status, videoUrl: videoUrl, error: prediction.error || null });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao consultar predicao.', details: error.message });
    }
});

app.post('/api/prediction/:id/cancel', async (req, res) => {
    try {
        await replicate.predictions.cancel(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao cancelar.', details: error.message });
    }
});

app.post('/api/enhance-prompt', (req, res) => {
    res.json({ enhanced: req.body.prompt });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[NEXORA] Rodando na porta ' + PORT));
