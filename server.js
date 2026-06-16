const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

const FIREBASE_BASE_URL = "https://cash-jitau-default-rtdb.firebaseio.com";

app.use(express.json());

app.get('/', (req, res) => {
    res.send("<h1>Server Connected Properly</h1>");
});

app.get('/postback', async (req, res) => {
    const { user_id, reward } = req.query;

    if (!user_id || !reward) {
        return res.status(400).send("Missing parameters");
    }

    try {
        const rewardAmount = Math.trunc(Number(reward));
        const userUrl = `${FIREBASE_BASE_URL}/users/${user_id}/balance.json`;

        // १. फायरबेसबाट पुरानो ब्यालेन्स तान्ने
        const response = await axios.get(userUrl);
        const currentBalance = response.data !== null ? Number(response.data) : 0;
        
        // २. नयाँ ब्यालेन्स हिसाब गरेर सिधै राख्ने
        const newBalance = currentBalance + rewardAmount;
        await axios.put(userUrl, newBalance);

        console.log(`✅ Success: Updated ${user_id} with ${rewardAmount}.`);
        return res.status(200).send("OK");

    } catch (error) {
        console.error("Firebase Update Error:", error.message);
        // ४०१ इरर आउन नदिन जस्तो सुकै अवस्थामा पनि OK नै पठाउने
        return res.status(200).send("OK");
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
