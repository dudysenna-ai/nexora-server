const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({ status: 'NEXORA Server Online', engine: 'Gemini' });
});

app.post('/api/enhance-prompt', async (req, res) => {
    try {
        const { prompt, type, system } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt required' });
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.json({ enhanced: prompt });
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const sysText = system || 'Expand this prompt into a detailed cinematic English description. Return ONLY the expanded prompt.';
        const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }], systemInstruction: { parts: [{ text: sysText }] } });
        const text = result.response.text();
        res.json({ enhanced: text.trim() });
    } catch (error) {
        console.error('Enhance error:', error.message);
        res.json({ enhanced: req.body.prompt });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const systemMsg = messages.find(m => m.role === 'system');
        const chatMsgs = messages.filter(m => m.role !== 'system');
        const history = chatMsgs.slice(0, -1).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
        const lastMsg = chatMsgs[chatMsgs.length - 1];
        const chat = model.startChat({ history: history, systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined });
        const result = await chat.sendMessage(lastMsg.content);
        res.json({ reply: result.response.text() });
    } catch (error) {
        console.error('Chat error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-video', async (req, res) => {
    try {
        const { prompt, style, camera } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt required' });
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
        const genAI = new GoogleGenerativeAI(apiKey);
        const fullPrompt = [prompt, style, camera].filter(Boolean).join(', ');
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(fullPrompt);
        res.json({ success: true, prompt_used: fullPrompt, result: result.response.text(), engine: 'gemini' });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log('NEXORA Server running on port ' + PORT);
});
