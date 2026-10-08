
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

app.post('/api/generate-video', async (req, res) => {
  try {
    const { prompt, aspect_ratio, style, camera, mode } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const fullPrompt = [prompt, style, camera, mode].filter(Boolean).join(', ');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();
    res.json({
      success: true,
      prompt_used: fullPrompt,
      result: text,
      engine: 'gemini'
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log('NEXORA Server running on port ' + PORT);
