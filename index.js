import express from 'express';
import axios from 'axios';
import fs from 'fs';

const app = express();
const port = 3000;

const maxStorageMessage = 26;

function fetchData(history, senderID) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=AIzaSyCF2-xtGZ1HOjUD4ST93jSJxlCR-lLyVU4'; 

    const requestData = {
        contents: history,
        safetySettings: [
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }
      ],
      generationConfig: {
          temperature: 1.0,
          maxOutputTokens: 1000,
          topP: 0.9,
          topK: 16
      }
    };

    return axios.post(url, requestData, {
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(response => {
        const { candidates } = response.data;
        if (!candidates || candidates.length === 0) {
            throw new Error('Invalid response format: missing candidates');
        }

        const { content } = candidates[0];
        if (!content || !content.parts || content.parts.length === 0) {
            throw new Error('Invalid response format: missing content parts');
        }

        return content.parts[0].text;
    }).catch(error => {
      console.error(error.response.data);
        throw new Error(error);
    });
}

function loadHistory() {
    const historyFilePath = "history.json";
    try {
        if (fs.existsSync(historyFilePath)) {
            const rawData = fs.readFileSync(historyFilePath);
            return JSON.parse(rawData);
        } else {
            return {};
        }
    } catch (error) {
        console.error("Error loading history:", error);
        return {};
    }
}

function saveHistory(history) {
    const historyFilePath = "history.json";
    try {
        fs.writeFileSync(historyFilePath, JSON.stringify(history));
    } catch (error) {
        console.error("Error saving history:", error);
    }
}

app.get('/', (req, res) => {
  res.send('Hello!'); 
});

app.get('/gen', (req, res) => {
    const senderID = req.query.id;
    const name = req.query.name || "stranger";
    const prompt = req.query.q;

    if (!senderID || !prompt) {
        return res.status(400).json({ success: false, status: 400, error: 'senderID and prompt are required' });
    }

    const history = loadHistory();
    const userHistory = history[senderID];
    userHistory.push({ role: "user", parts: [{ text: prompt }] });
    fetchData(userHistory, senderID)
        .then(response => {
            res.send( response );

            
            userHistory.push({ role: "model", parts: [{ text: response }] });

            if (userHistory.length > maxStorageMessage * 2) {
                userHistory.splice(6, userHistory.length - maxStorageMessage * 2);
            }

            history[senderID] = userHistory;
            saveHistory(history);
        })
        .catch(error => {
            console.error(error.message);
            res.status(500).json({ success: false, status: 500, error: error });
        });
});

app.get('/clear/:id', (req, res) => {
    const senderID = req.params.id;

    if (!senderID) {
        return res.status(400).json({ error: 'senderID is required' });
    }

    const history = loadHistory();
    if (history[senderID]) {
        delete history[senderID];
        saveHistory(history);
        res.json({status: 200, data:'Conversation deleted successfully.', message: 'uhh, my head hurts'});
    } else {
        res.status(404).json({ error: 'Conversation not found.' });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
