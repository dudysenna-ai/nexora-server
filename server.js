const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const HF_TOKEN = process.env.HF_TOKEN;

// ============================================
// Health Check
// ============================================
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'NEXORA AI Server',
        version: '2.0.0',
        endpoints: [
            'POST /api/generate-video',
            'GET /api/prediction/:id',
            'POST /api/enhance-prompt'
        ]
    });
});

// ============================================
// Gerar Video via Replicate (Wan 2.1)
// ============================================
app.post('/api/generate-video', async (req, res) => {
    try {
        const { prompt, aspect_ratio, duration, fps, seed, style, motion, camera, mode, image_url } = req.body;

        if (!prompt && mode !== 'image') {
            return res.status(400).json({ error: 'Prompt e obrigatorio.' });
        }

        if (!REPLICATE_API_TOKEN) {
            return res.status(500).json({ error: 'REPLICATE_API_TOKEN nao configurado no servidor.' });
        }

        // ----- Mapear parametros -----

        // Resolucao baseada no aspect ratio
        let width = 848, height = 480;
        if (aspect_ratio === '9:16') { width = 480; height = 848; }
        else if (aspect_ratio === '1:1') { width = 640; height = 640; }
        else if (aspect_ratio === '4:5') { width = 576; height = 720; }
        else { width = 848; height = 480; } // 16:9 padrao

        // Numero de frames baseado na duracao
        let num_frames = 81; // ~5 segundos padrao do Wan 2.1
        if (duration === '5s') num_frames = 33;
        else if (duration === '15s') num_frames = 81;
        else if (duration === '30s') num_frames = 81; // max do modelo
        else if (duration === '60s') num_frames = 81;

        // FPS
        let target_fps = 16; // Wan 2.1 gera a 16fps nativo
        if (fps === '24fps') target_fps = 16;
        else if (fps === '30fps') target_fps = 16;
        else if (fps === '60fps') target_fps = 16;

        // Seed
        const seedVal = seed ? parseInt(seed) : Math.floor(Math.random() * 999999);

        // Montar prompt enriquecido com estilo e camera
        let fullPrompt = prompt || '';
        if (style && style !== 'Cinematic Realistic') {
            fullPrompt += `, ${style} style`;
        }
        if (camera && camera !== 'Dynamic Auto') {
            fullPrompt += `, ${camera} camera movement`;
        }
        fullPrompt += ', high quality, detailed, professional';

        // ----- Escolher modelo -----
        let modelVersion;
        let input;

        if (mode === 'image' && image_url) {
            // Image-to-Video: Wan 2.1 I2V
            modelVersion = 'wan-ai/wan2.1-i2v-14b-480p';
            input = {
                prompt: fullPrompt,
                image: image_url,
                max_area: '832x480',
                num_frames: num_frames,
                seed: seedVal,
                guidance_scale: 5,
                num_inference_steps: 28
            };
        } else {
            // Text-to-Video: Wan 2.1 T2V
            modelVersion = 'wan-ai/wan2.1-t2v-14b';
            input = {
                prompt: fullPrompt,
                max_area: `${width}x${height}`,
                num_frames: num_frames,
                seed: seedVal,
                guidance_scale: 5,
                num_inference_steps: 30
            };
        }

        console.log(`[NEXORA] Criando predicao: modelo=${modelVersion}`);
        console.log(`[NEXORA] Input:`, JSON.stringify(input, null, 2));

        // ----- Criar predicao no Replicate -----
        const createResponse = await fetch('https://api.replicate.com/v1/models/' + modelVersion + '/predictions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
                'Content-Type': 'application/json',
                'Prefer': 'respond-async'
            },
            body: JSON.stringify({ input })
        });

        if (!createResponse.ok) {
            const errText = await createResponse.text();
            console.error('[NEXORA] Erro Replicate:', errText);
            return res.status(createResponse.status).json({
                error: 'Erro ao criar predicao no Replicate.',
                details: errText
            });
        }

        const prediction = await createResponse.json();
        console.log(`[NEXORA] Predicao criada: id=${prediction.id}, status=${prediction.status}`);

        return res.json({
            success: true,
            predictionId: prediction.id,
            status: prediction.status,
            model: modelVersion
        });

    } catch (error) {
        console.error('[NEXORA] Erro interno:', error);
        res.status(500).json({ error: 'Erro interno do servidor.', details: error.message });
    }
});

// ============================================
// Consultar Status da Predicao
// ============================================
app.get('/api/prediction/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!REPLICATE_API_TOKEN) {
            return res.status(500).json({ error: 'REPLICATE_API_TOKEN nao configurado.' });
        }

        const response = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
            headers: {
                'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errText = await response.text();
            return res.status(response.status).json({ error: 'Erro ao consultar predicao.', details: errText });
        }

        const prediction = await response.json();

        let videoUrl = null;
        if (prediction.status === 'succeeded' && prediction.output) {
            // O output pode ser uma string (URL) ou um array
            if (typeof prediction.output === 'string') {
                videoUrl = prediction.output;
            } else if (Array.isArray(prediction.output) && prediction.output.length > 0) {
                videoUrl = prediction.output[0];
            } else if (prediction.output.url) {
                videoUrl = prediction.output.url;
            }
        }

        return res.json({
            id: prediction.id,
            status: prediction.status,
            progress: prediction.logs ? estimateProgress(prediction.logs) : null,
            videoUrl: videoUrl,
            error: prediction.error || null,
            logs: prediction.logs || ''
        });

    } catch (error) {
        console.error('[NEXORA] Erro ao consultar predicao:', error);
        res.status(500).json({ error: 'Erro interno.', details: error.message });
    }
});

// Estimar progresso baseado nos logs
function estimateProgress(logs) {
    if (!logs) return 0;
    // Tentar extrair porcentagem dos logs do Replicate
    const matches = logs.match(/(\d+)%/g);
    if (matches && matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        return parseInt(lastMatch);
    }
    // Tentar extrair step/total
    const stepMatch = logs.match(/(\d+)\/(\d+)/);
    if (stepMatch) {
        return Math.round((parseInt(stepMatch[1]) / parseInt(stepMatch[2])) * 100);
    }
    return null;
}

// ============================================
// Enhance Prompt (opcional - proxy para Gemini)
// ============================================
app.post('/api/enhance-prompt', async (req, res) => {
    try {
        const { prompt, type } = req.body;
        // Este endpoint pode ser usado como proxy se a chave Gemini estiver no servidor
        // Por agora, retorna o prompt original
        res.json({ enhanced: prompt });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao melhorar prompt.' });
    }
});

// ============================================
// Cancelar Predicao
// ============================================
app.post('/api/prediction/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;

        const response = await fetch(`https://api.replicate.com/v1/predictions/${id}/cancel`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        res.json({ success: true, status: data.status });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao cancelar predicao.' });
    }
});

// ============================================
// Iniciar Servidor
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[NEXORA] Servidor rodando na porta ${PORT}`);
    console.log(`[NEXORA] REPLICATE_API_TOKEN: ${REPLICATE_API_TOKEN ? 'Configurado' : 'NAO CONFIGURADO'}`);
    console.log(`[NEXORA] HF_TOKEN: ${HF_TOKEN ? 'Configurado' : 'NAO CONFIGURADO'}`);
});
