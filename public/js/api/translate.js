export const config = {
    api: {
        bodyParser: true,
    },
};

import deepl from 'deepl-node';

export default async function handler(req, res) {
    // Sadece POST isteklerine izin ver
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { text, targetLang = 'TR' } = req.body;
        const authKey = process.env.DEEPL_API_KEY;
        const translator = new deepl.Translator(authKey);
        const result = await translator.translateText(text, 'EN', targetLang);
        res.status(200).json({ translated: result.text });
    } catch (error) {
        console.error('DeepL hatası:', error);
        res.status(500).json({ error: 'Çeviri başarısız' });
    }
}